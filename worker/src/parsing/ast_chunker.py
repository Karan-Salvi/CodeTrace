from dataclasses import dataclass

import tree_sitter_javascript as tsjavascript
import tree_sitter_python as tspython
import tree_sitter_typescript as tstypescript
from tree_sitter import Language, Node, Parser


@dataclass
class Chunk:
    symbol: str
    symbol_type: str  # FUNCTION | METHOD | CLASS | INTERFACE
    parent_symbol: str | None
    start_line: int
    end_line: int
    content: str


_LANGUAGES = {
    "javascript": Language(tsjavascript.language()),
    "typescript": Language(tstypescript.language_typescript()),
    "python": Language(tspython.language()),
}

# Single source of truth for file-extension -> language detection, used
# by both full_index.py and incremental_index.py — was previously
# duplicated identically in both files, a maintenance hazard where
# adding a new extension to one pipeline but not the other would make
# them silently recognize a different set of languages.
LANGUAGE_BY_EXT = {
    ".js": "javascript", ".jsx": "javascript",
    ".ts": "typescript", ".tsx": "typescript",
    ".py": "python",
}

# node types that count as chunk boundaries, per language
_CHUNK_NODE_TYPES = {
    "javascript": {
        "function_declaration": "FUNCTION",
        "method_definition": "METHOD",
        "class_declaration": "CLASS",
        "arrow_function": "FUNCTION",
        "function_expression": "FUNCTION",
    },
    "typescript": {
        "function_declaration": "FUNCTION",
        "method_definition": "METHOD",
        "class_declaration": "CLASS",
        "interface_declaration": "INTERFACE",
        "arrow_function": "FUNCTION",
        "function_expression": "FUNCTION",
    },
    "python": {
        "function_definition": "FUNCTION",
        "class_definition": "CLASS",
    },
}

# arrow_function/function_expression have no `name` field of their own —
# tree-sitter's JS/TS grammar puts the name on the enclosing declarator
# (`const foo = () => {}`) or class field (`foo = () => {}`), as a sibling
# node, not a child field of the function node itself. Without this, every
# arrow-function export/handler/field — the dominant style across this very
# codebase's own backend (Express route handlers, React components) — would
# be silently skipped by chunk_file's `if name:` guard, never chunked or
# embedded, and invisible to retrieval.
_UNNAMED_FUNCTION_PARENT_NAME_FIELD = {
    "variable_declarator": "name",
    "field_definition": "property",  # JS grammar
    "public_field_definition": "name",  # TS grammar — different field name than JS's field_definition
}


def _extract_name(node: Node, source: bytes) -> str | None:
    name_node = node.child_by_field_name("name")
    if name_node is not None:
        return source[name_node.start_byte:name_node.end_byte].decode("utf-8")

    if node.type in ("arrow_function", "function_expression") and node.parent is not None:
        field = _UNNAMED_FUNCTION_PARENT_NAME_FIELD.get(node.parent.type)
        if field is not None:
            parent_name_node = node.parent.child_by_field_name(field)
            if parent_name_node is not None:
                return source[parent_name_node.start_byte:parent_name_node.end_byte].decode("utf-8")

    return None


def _walk(node: Node, source: bytes, language: str, parent_class: str | None, chunks: list[Chunk]) -> None:
    node_types = _CHUNK_NODE_TYPES[language]

    if node.type in node_types:
        name = _extract_name(node, source)
        if name:
            symbol_type = node_types[node.type]
            # a function_definition/declaration nested directly inside a
            # class body is a method, not a top-level function
            if symbol_type == "FUNCTION" and parent_class is not None:
                symbol_type = "METHOD"

            chunks.append(
                Chunk(
                    symbol=name,
                    symbol_type=symbol_type,
                    parent_symbol=parent_class if symbol_type == "METHOD" else None,
                    start_line=node.start_point[0] + 1,
                    end_line=node.end_point[0] + 1,
                    content=source[node.start_byte:node.end_byte].decode("utf-8"),
                )
            )

        is_class_node = node.type.endswith(("class_declaration", "class_definition"))
        next_parent: str | None
        if is_class_node:
            next_parent = name
        else:
            # Anything nested inside a function/method body — even a
            # helper defined directly under a class's method — is no
            # longer "directly in the class". Without this reset, a
            # closure declared inside a method would inherit the
            # enclosing class as its parent and get misclassified as a
            # sibling METHOD of that class instead of its own standalone
            # FUNCTION (or unnamed nested helper).
            next_parent = None

        for child in node.children:
            _walk(child, source, language, next_parent, chunks)
        return

    for child in node.children:
        _walk(child, source, language, parent_class, chunks)


def chunk_file(content: str, language: str) -> list[Chunk]:
    if language not in _LANGUAGES:
        return []

    parser = Parser(_LANGUAGES[language])
    source = content.encode("utf-8")
    tree = parser.parse(source)

    chunks: list[Chunk] = []
    try:
        _walk(tree.root_node, source, language, None, chunks)
    except RecursionError:
        # _walk is plain recursive descent over the AST with no depth
        # guard. A pathologically nested source file (deeply chained
        # callbacks, generated/minified code, hundreds of nested `if`
        # blocks) blows Python's default recursion limit — this used to
        # propagate all the way up and abort the entire repository
        # index over one bad file, and every BullMQ retry would hit the
        # identical crash forever (indexing.md: never leave a job
        # permanently stuck). Treat it the same as an unparseable file:
        # no chunks, not a fatal error for the whole run.
        return []
    return chunks

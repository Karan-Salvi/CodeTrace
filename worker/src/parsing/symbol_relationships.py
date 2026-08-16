from dataclasses import dataclass

from tree_sitter import Node, Parser

from src.parsing.ast_chunker import _LANGUAGES, Chunk


@dataclass
class Relationship:
    relationship_type: str  # CALLS | IMPORTS
    from_symbol: str | None
    to_symbol_or_external: str


def _find_symbol_for_node(node: Node, chunks_sorted_by_size: list[Chunk]) -> str | None:
    line = node.start_point[0] + 1
    # chunks_sorted_by_size is pre-sorted ascending by size (narrowest/
    # innermost chunk first) once by the caller — re-sorting per call-node
    # here made this O(calls x chunks log chunks) instead of
    # O(chunks log chunks + calls x chunks), measured at 1.6s of pure
    # blocking CPU work for a 1500-function file (~15000 calls). That's
    # synchronous work inside an async indexing pipeline with no
    # to_thread wrapping — the same event-loop-starvation risk as
    # clone.py's blocking subprocess.run, just CPU-bound instead of I/O.
    for chunk in chunks_sorted_by_size:
        if chunk.start_line <= line <= chunk.end_line:
            return chunk.symbol
    return None


def _extract_name(node: Node, source: bytes) -> str | None:
    if node is None:
        return None
    return source[node.start_byte:node.end_byte].decode("utf-8")


def _walk_for_imports(node: Node, source: bytes, relationships: list[Relationship]) -> None:
    # JS/TS: import { x } from "./module" — the module path sits in a
    # "source" field (a quoted string literal).
    if node.type == "import_statement":
        source_node = node.child_by_field_name("source")
        if source_node:
            path = _extract_name(source_node, source)
            if path and len(path) >= 2:
                path = path[1:-1]
                relationships.append(
                    Relationship(
                        relationship_type="IMPORTS",
                        from_symbol=None,
                        to_symbol_or_external=path,
                    )
                )
        else:
            # Python: `import os` — same node type name as JS/TS's
            # import_statement, but the module path is a "name" field
            # (dotted_name), not a "source" field.
            name_node = node.child_by_field_name("name")
            if name_node:
                path = _extract_name(name_node, source)
                if path:
                    relationships.append(
                        Relationship(
                            relationship_type="IMPORTS",
                            from_symbol=None,
                            to_symbol_or_external=path,
                        )
                    )

    # Python: `from src.config import get_settings` — module path is a
    # "module_name" field (dotted_name).
    if node.type == "import_from_statement":
        module_node = node.child_by_field_name("module_name")
        if module_node:
            path = _extract_name(module_node, source)
            if path:
                relationships.append(
                    Relationship(
                        relationship_type="IMPORTS",
                        from_symbol=None,
                        to_symbol_or_external=path,
                    )
                )

    for child in node.children:
        _walk_for_imports(child, source, relationships)


def _walk_for_calls(
    node: Node, source: bytes, chunks_sorted_by_size: list[Chunk], relationships: list[Relationship]
) -> None:
    # JS/TS uses "call_expression"; Python uses "call" — same shape
    # (both expose a "function" field for the callee), different node
    # type name per language grammar.
    if node.type in ("call_expression", "call"):
        func_node = node.child_by_field_name("function")
        if func_node:
            target = _extract_name(func_node, source)
            if target:
                from_symbol = _find_symbol_for_node(node, chunks_sorted_by_size)
                relationships.append(
                    Relationship(
                        relationship_type="CALLS",
                        from_symbol=from_symbol,
                        to_symbol_or_external=target,
                    )
                )

    for child in node.children:
        _walk_for_calls(child, source, chunks_sorted_by_size, relationships)


def extract_relationships(content: str, language: str, chunks: list[Chunk]) -> list[Relationship]:
    if language not in _LANGUAGES:
        return []

    parser = Parser(_LANGUAGES[language])
    source = content.encode("utf-8")
    tree = parser.parse(source)

    # Sort once here instead of once per call-node visited — see
    # _find_symbol_for_node.
    chunks_sorted_by_size = sorted(chunks, key=lambda c: c.end_line - c.start_line)

    relationships: list[Relationship] = []
    try:
        _walk_for_imports(tree.root_node, source, relationships)
        _walk_for_calls(tree.root_node, source, chunks_sorted_by_size, relationships)
    except RecursionError:
        # Same unguarded recursive-descent issue as ast_chunker.py's
        # _walk, and not covered by that fix: full_index.py/
        # incremental_index.py call extract_relationships unconditionally
        # right after chunk_file, even when chunk_file already returned []
        # for this exact reason. A pathologically nested file must not
        # crash the whole repository index here either.
        return []

    return relationships

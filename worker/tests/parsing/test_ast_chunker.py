from src.parsing.ast_chunker import chunk_file

TS_SAMPLE = """
export function handleAuthError(err: Error) {
  return { status: 401 };
}

export class AuthService {
  async login(credentials: unknown) {
    return this.handleAuthError();
  }
}
"""

PY_SAMPLE = """
def handle_auth_error(err):
    return {"status": 401}

class AuthService:
    async def login(self, credentials):
        return self.handle_auth_error()
"""

def test_chunks_typescript_function_and_class_method() -> None:
    chunks = chunk_file(TS_SAMPLE, "typescript")
    symbols = {c.symbol for c in chunks}
    assert "handleAuthError" in symbols
    assert "login" in symbols

    login_chunk = next(c for c in chunks if c.symbol == "login")
    assert login_chunk.symbol_type == "METHOD"
    assert login_chunk.parent_symbol == "AuthService"

    func_chunk = next(c for c in chunks if c.symbol == "handleAuthError")
    assert func_chunk.symbol_type == "FUNCTION"
    assert func_chunk.parent_symbol is None

def test_chunks_python_function_and_class_method() -> None:
    chunks = chunk_file(PY_SAMPLE, "python")
    symbols = {c.symbol for c in chunks}
    assert "handle_auth_error" in symbols
    assert "login" in symbols

    login_chunk = next(c for c in chunks if c.symbol == "login")
    assert login_chunk.parent_symbol == "AuthService"

def test_chunk_line_ranges_are_valid() -> None:
    chunks = chunk_file(TS_SAMPLE, "typescript")
    for chunk in chunks:
        assert chunk.start_line <= chunk.end_line
        assert chunk.start_line >= 1

def test_unsupported_language_returns_empty() -> None:
    assert chunk_file("<?php echo 1; ?>", "php") == []


NESTED_HELPER_SAMPLE = """
class AuthService {
  login(credentials) {
    function helper(x) {
      return x + 1;
    }
    return helper(credentials);
  }
}
"""


def test_function_nested_inside_a_method_is_not_misclassified_as_a_sibling_method() -> None:
    chunks = chunk_file(NESTED_HELPER_SAMPLE, "typescript")

    login_chunk = next(c for c in chunks if c.symbol == "login")
    assert login_chunk.symbol_type == "METHOD"
    assert login_chunk.parent_symbol == "AuthService"

    helper_chunk = next(c for c in chunks if c.symbol == "helper")
    assert helper_chunk.symbol_type == "FUNCTION"
    assert helper_chunk.parent_symbol is None


ARROW_FUNCTION_SAMPLE = """
export const handleAuthError = (err) => {
  return { status: 401 };
};

class AuthService {
  login = async (credentials) => {
    return this.handleAuthError();
  };
}
"""


def test_chunks_top_level_arrow_function() -> None:
    # Regression: arrow functions (const foo = () => {}) — the dominant
    # style throughout this project's own backend — used to be silently
    # skipped entirely, since arrow_function has no `name` field of its
    # own and wasn't in _CHUNK_NODE_TYPES at all.
    chunks = chunk_file(ARROW_FUNCTION_SAMPLE, "typescript")
    func_chunk = next(c for c in chunks if c.symbol == "handleAuthError")
    assert func_chunk.symbol_type == "FUNCTION"
    assert func_chunk.parent_symbol is None


def test_chunks_class_field_arrow_function_as_method() -> None:
    # Regression: TS and JS grammars name the class-field's name field
    # differently (public_field_definition.name vs field_definition.property)
    # — the first fix attempt used "property" for both and silently missed
    # every TS class-field arrow handler (e.g. `login = async () => {}`,
    # the common this-binding pattern for Express/React handlers).
    chunks = chunk_file(ARROW_FUNCTION_SAMPLE, "typescript")
    login_chunk = next(c for c in chunks if c.symbol == "login")
    assert login_chunk.symbol_type == "METHOD"
    assert login_chunk.parent_symbol == "AuthService"


def test_chunks_class_field_arrow_function_javascript_grammar() -> None:
    chunks = chunk_file(ARROW_FUNCTION_SAMPLE, "javascript")
    login_chunk = next(c for c in chunks if c.symbol == "login")
    assert login_chunk.symbol_type == "METHOD"
    assert login_chunk.parent_symbol == "AuthService"


def test_chunk_file_does_not_crash_on_pathologically_nested_source() -> None:
    # Regression: _walk is plain recursive descent over the AST with no
    # depth guard. A file with hundreds of nested blocks (generated code,
    # deeply chained callbacks) blew Python's default recursion limit and
    # raised RecursionError, which propagated all the way up and aborted
    # the entire repository index over a single bad file — and every
    # BullMQ retry would hit the identical crash again, permanently
    # stuck (indexing.md: never leave a job stuck with no path forward).
    deeply_nested = "function outer() {\n" + "if (true) {\n" * 2000 + "}\n" * 2000 + "}\n"
    chunks = chunk_file(deeply_nested, "javascript")
    assert chunks == []

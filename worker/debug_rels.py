from src.parsing.ast_chunker import chunk_file
from src.parsing.symbol_relationships import extract_relationships

TS_SAMPLE = """
export class AuthService {
  async login(credentials: unknown) {
    return handleAuthError(new Error("bad"));
  }
}
"""

chunks = chunk_file(TS_SAMPLE, "typescript")
print([(c.symbol, c.start_line, c.end_line) for c in chunks])
rels = extract_relationships(TS_SAMPLE, "typescript", chunks)
print(rels)

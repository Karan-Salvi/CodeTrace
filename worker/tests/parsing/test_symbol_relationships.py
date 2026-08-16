from src.parsing.ast_chunker import chunk_file
from src.parsing.symbol_relationships import extract_relationships

TS_SAMPLE = """
import { logger } from "./logger";

export function handleAuthError(err: Error) {
  logger.warn(err);
  return { status: 401 };
}

export class AuthService {
  async login(credentials: unknown) {
    return handleAuthError(new Error("bad"));
  }
}
"""

def test_extracts_call_edge_within_file() -> None:
    chunks = chunk_file(TS_SAMPLE, "typescript")
    relationships = extract_relationships(TS_SAMPLE, "typescript", chunks)

    calls_edges = [r for r in relationships if r.relationship_type == "CALLS"]
    assert any(
        r.from_symbol == "login" and r.to_symbol_or_external == "handleAuthError"
        for r in calls_edges
    )

def test_extracts_external_call_as_unresolved() -> None:
    chunks = chunk_file(TS_SAMPLE, "typescript")
    relationships = extract_relationships(TS_SAMPLE, "typescript", chunks)

    external_calls = [
        r for r in relationships
        if r.relationship_type == "CALLS" and r.from_symbol == "handleAuthError"
    ]
    assert any(r.to_symbol_or_external == "logger.warn" or "logger" in r.to_symbol_or_external for r in external_calls)

def test_extracts_import_edge() -> None:
    chunks = chunk_file(TS_SAMPLE, "typescript")
    relationships = extract_relationships(TS_SAMPLE, "typescript", chunks)

    import_edges = [r for r in relationships if r.relationship_type == "IMPORTS"]
    assert any(r.to_symbol_or_external == "./logger" for r in import_edges)


PY_SAMPLE = """
import os
from src.config import get_settings


def handle_auth_error(err):
    logger.warn(err)
    return get_settings()


class AuthService:
    async def login(self, credentials):
        return handle_auth_error(credentials)
"""


def test_extracts_call_edge_within_python_file() -> None:
    chunks = chunk_file(PY_SAMPLE, "python")
    relationships = extract_relationships(PY_SAMPLE, "python", chunks)

    calls_edges = [r for r in relationships if r.relationship_type == "CALLS"]
    assert any(
        r.from_symbol == "login" and r.to_symbol_or_external == "handle_auth_error"
        for r in calls_edges
    )


def test_extracts_external_call_as_unresolved_in_python() -> None:
    chunks = chunk_file(PY_SAMPLE, "python")
    relationships = extract_relationships(PY_SAMPLE, "python", chunks)

    external_calls = [
        r for r in relationships
        if r.relationship_type == "CALLS" and r.from_symbol == "handle_auth_error"
    ]
    assert any("logger" in r.to_symbol_or_external for r in external_calls)


def test_extracts_plain_import_edge_in_python() -> None:
    chunks = chunk_file(PY_SAMPLE, "python")
    relationships = extract_relationships(PY_SAMPLE, "python", chunks)

    import_edges = [r for r in relationships if r.relationship_type == "IMPORTS"]
    assert any(r.to_symbol_or_external == "os" for r in import_edges)


def test_extracts_from_import_edge_in_python() -> None:
    chunks = chunk_file(PY_SAMPLE, "python")
    relationships = extract_relationships(PY_SAMPLE, "python", chunks)

    import_edges = [r for r in relationships if r.relationship_type == "IMPORTS"]
    assert any(r.to_symbol_or_external == "src.config" for r in import_edges)


def test_extract_relationships_scales_with_many_chunks_and_calls() -> None:
    # Regression: _find_symbol_for_node used to re-sort the full chunks
    # list on every single call-node visited (O(calls x chunks log
    # chunks) instead of sorting once), measured at 1.6s of blocking CPU
    # work for a 1500-function/15000-call file — synchronous work inside
    # an async indexing pipeline with no to_thread wrapping, the same
    # event-loop-starvation risk as clone.py's blocking subprocess.run.
    # Not a timing assertion (flaky in CI) — just proves the sort-once
    # refactor still attributes every call to its correct enclosing chunk
    # at a scale where a re-broken sort would be catastrophically slow.
    lines = []
    for i in range(200):
        lines.append(f"function fn{i}() {{")
        lines.append(f"  helper(fn{i});")
        lines.append("}")
    source = "\n".join(lines)

    chunks = chunk_file(source, "javascript")
    relationships = extract_relationships(source, "javascript", chunks)

    calls_edges = [r for r in relationships if r.relationship_type == "CALLS"]
    assert len(calls_edges) == 200
    assert all(r.from_symbol == f"fn{i}" for i, r in enumerate(calls_edges))


def test_extract_relationships_does_not_crash_on_pathologically_nested_source() -> None:
    # Regression: _walk_for_imports/_walk_for_calls are plain recursive
    # descent with no depth guard, same class of bug as ast_chunker.py's
    # _walk. Not covered by that fix — full_index.py/incremental_index.py
    # call extract_relationships unconditionally right after chunk_file,
    # even when chunk_file already returned [] for the same file. A
    # deeply nested file must not crash the whole repository index here
    # either.
    deeply_nested = "function outer() {\n" + "if (true) {\n" * 2000 + "}\n" * 2000 + "}\n"
    relationships = extract_relationships(deeply_nested, "javascript", [])
    assert relationships == []

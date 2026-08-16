import type { Citation } from "@codetrace/shared-types";
import type { RetrievedChunk } from "../../retrieval/types/retrieval.types.js";

// retrieval.md: every citation is re-checked against what was actually
// retrieved — file/chunk exists, belongs to the repo, line numbers valid,
// was part of retrieved context. Never trust the LLM's self-report.
export function validateCitation(citation: Citation, retrievedChunks: RetrievedChunk[]): boolean {
  const match = retrievedChunks.find((c) => c.id === citation.chunkId);
  if (!match) return false;
  if (match.filePath !== citation.file) return false;
  if (match.startLine !== citation.startLine || match.endLine !== citation.endLine) return false;
  return true;
}

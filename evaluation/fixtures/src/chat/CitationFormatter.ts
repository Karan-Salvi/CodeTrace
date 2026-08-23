export function formatCitation(chunk: { file: { path: string }; startLine: number }) {
  return `${chunk.file.path}:${chunk.startLine}`;
}
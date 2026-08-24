export function formatDiffSummary(filesChanged: number, insertions: number, deletions: number) {
  return `${filesChanged} files changed, +${insertions} -${deletions}`;
}

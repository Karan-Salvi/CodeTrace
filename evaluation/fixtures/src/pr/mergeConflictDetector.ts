export function hasMergeConflict(diffText: string) {
  return diffText.includes("<<<<<<<") || diffText.includes(">>>>>>>");
}

export function parseDiffHeader(line: string) {
  const shaRange = line.split(" ")[2].split("..")[0];
  return { fromSha: shaRange };
}
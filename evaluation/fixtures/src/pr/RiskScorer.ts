export function calculateRiskScore(findings: Array<{ category: string }>) {
  let score = 0;
  for (const finding of findings) {
    if (finding.category === "SECURITY") score += 40;
    else if (finding.category === "BUG") score += 25;
    else score += 10;
  }
  return Math.min(score, 100);
}
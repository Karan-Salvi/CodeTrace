export async function releaseJob(
  jobId: string,
  db: { setStatus: (id: string, status: string) => Promise<void> }
) {
  await db.setStatus(jobId, "AVAILABLE");
  return { released: true };
}

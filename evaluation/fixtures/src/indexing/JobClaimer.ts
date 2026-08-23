export async function claimJob(
  db: { getStatus: (jobId: string) => Promise<string>; setStatus: (jobId: string, status: string) => Promise<void> },
  jobId: string
) {
  const status = await db.getStatus(jobId);
  if (status === "PENDING") {
    await db.setStatus(jobId, "RUNNING");
    return true;
  }
  return false;
}
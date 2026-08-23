export async function updateUserSettings(
  db: { update: (id: string, data: unknown) => Promise<void> },
  targetUserId: string,
  settings: Record<string, unknown>
) {
  await db.update(targetUserId, settings);
  return { updated: targetUserId };
}
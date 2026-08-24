export async function resetUserSettings(
  userId: string,
  db: { update: (id: string, data: object) => Promise<void> }
) {
  await db.update(userId, { theme: "system", notifications: true });
  return { reset: true };
}

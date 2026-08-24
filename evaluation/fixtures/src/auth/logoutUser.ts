export async function logoutUser(
  sessionId: string,
  sessionStore: { revoke: (id: string) => Promise<void> }
) {
  await sessionStore.revoke(sessionId);
  return { ok: true };
}

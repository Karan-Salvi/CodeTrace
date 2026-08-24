export async function refreshAccessToken(
  refreshToken: string,
  tokenStore: { rotate: (t: string) => Promise<string> }
) {
  if (!refreshToken) {
    throw new Error("Missing refresh token");
  }
  return tokenStore.rotate(refreshToken);
}

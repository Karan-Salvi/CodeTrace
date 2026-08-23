export function handleAuthError(err: Error) {
  if (err.name === "TokenExpiredError") {
    return { status: 401, message: "Token expired" };
  }
  return { status: 500, message: "Unknown auth error" };
}
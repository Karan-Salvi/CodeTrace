export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 min, auth.md
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export const RETRIEVAL_TOP_K = 20; // RRF merge candidate pool, retrieval.md
export const RETRIEVAL_FINAL_K = 8; // returned to context assembly

export const SECRET_FILE_PATTERNS = [
  /^\.env(\..+)?$/,
  /\.pem$/,
  /\.key$/,
  /^secrets\./,
  /^credentials\./,
];

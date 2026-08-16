export interface AccessTokenPayload {
  userId: string;
  sessionId: string;
}

export interface GitHubProfile {
  id: number;
  login: string;
  email: string | null;
  avatar_url: string;
}

export interface SessionMeta {
  userAgent?: string;
  ipAddress?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

import { handleAuthError } from "./handleAuthError";

export class AuthService {
  async login(credentials: { code: string }) {
    try {
      return await this.exchangeCode(credentials.code);
    } catch (err) {
      return handleAuthError(err as Error);
    }
  }

  private async exchangeCode(code: string) {
    return { accessToken: `token-for-${code}` };
  }
}
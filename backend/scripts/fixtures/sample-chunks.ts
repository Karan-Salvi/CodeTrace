export interface FixtureChunk {
  path: string;
  symbol: string;
  symbolType: "FUNCTION" | "METHOD" | "CLASS" | "INTERFACE";
  parentSymbol: string | null;
  language: string;
  startLine: number;
  endLine: number;
  content: string;
  calls: string[]; // symbol names this chunk calls, resolved within the fixture set
}

export const SAMPLE_CHUNKS: FixtureChunk[] = [
  {
    path: "src/auth/handleAuthError.ts",
    symbol: "handleAuthError",
    symbolType: "FUNCTION",
    parentSymbol: null,
    language: "typescript",
    startLine: 1,
    endLine: 12,
    content:
      "export function handleAuthError(err: Error) {\n  if (err.name === 'TokenExpiredError') {\n    return { status: 401, message: 'Token expired' };\n  }\n  return { status: 500, message: 'Unknown auth error' };\n}",
    calls: [],
  },
  {
    path: "src/auth/AuthService.ts",
    symbol: "login",
    symbolType: "METHOD",
    parentSymbol: "AuthService",
    language: "typescript",
    startLine: 10,
    endLine: 25,
    content:
      "async login(credentials: Credentials) {\n  try {\n    return await this.githubOAuth.exchange(credentials);\n  } catch (err) {\n    return handleAuthError(err);\n  }\n}",
    calls: ["handleAuthError"],
  },
  {
    path: "src/repository/RepositoryService.ts",
    symbol: "connectRepository",
    symbolType: "FUNCTION",
    parentSymbol: null,
    language: "typescript",
    startLine: 5,
    endLine: 20,
    content:
      "export async function connectRepository(userId: string, input: ConnectInput) {\n  const installation = await getActiveInstallation(input.installationId);\n  return prisma.repository.create({ data: { userId, ...input } });\n}",
    calls: ["getActiveInstallation"],
  },
  {
    path: "src/repository/InstallationService.ts",
    symbol: "getActiveInstallation",
    symbolType: "FUNCTION",
    parentSymbol: null,
    language: "typescript",
    startLine: 1,
    endLine: 5,
    content:
      "export async function getActiveInstallation(id: string) {\n  return prisma.installation.findUnique({ where: { id } });\n}",
    calls: [],
  }
];

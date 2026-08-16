import { z } from "zod";

// z.string().url() alone accepts any well-formed URL/scheme — an
// authenticated user could register a repository row pointing at an
// arbitrary internal URL (cloud metadata endpoint, internal hostname,
// file://), which the worker then `git clone`s server-side with the
// installation token attached (SSRF via the worker as a trusted-network
// actor). githubUrl must actually be a https://github.com/<owner>/<name>
// URL, matching what worker/src/github/clone.py's token-injection and the
// backend's own webhook full_name matching already assume.
const GITHUB_REPO_URL_RE = /^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/;

export const connectRepositorySchema = z.object({
  installationId: z.string().uuid(),
  owner: z.string().min(1),
  name: z.string().min(1),
  githubUrl: z.string().url().regex(GITHUB_REPO_URL_RE, "githubUrl must be a https://github.com/<owner>/<name> URL"),
  defaultBranch: z.string().min(1),
});

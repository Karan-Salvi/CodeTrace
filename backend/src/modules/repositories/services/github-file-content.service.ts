import { GITHUB_API_BASE } from "./github-app.service.js";

export interface FileAtRefResult {
  content: string;
  tooLarge?: boolean;
  binary?: boolean;
}

// A real diff content line always contains printable text — a NUL byte, or
// a high ratio of other non-printable control characters in the first 8KB,
// is what a text editor / diff view can't meaningfully render anyway.
function looksBinary(text: string): boolean {
  const sample = text.slice(0, 8000);
  if (sample.length === 0) return false;
  if (sample.includes("\0")) return true;

  let nonPrintable = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    // Allow \t (9), \n (10), \r (13) — everything else below 32 is a
    // control character that shouldn't appear in real source text.
    if (code < 9 || (code > 13 && code < 32)) nonPrintable++;
  }
  return nonPrintable / sample.length > 0.3;
}

// Fetches one file's content at one git ref via GitHub's Contents API.
// Returns null when the file doesn't exist at that ref (the
// added/removed-file case in a diff — not an error). GitHub omits
// `content`/uses a non-"base64" encoding for files it refuses to serve
// inline (oversized, or certain binary formats it detects server-side) —
// treated here as tooLarge rather than parsed as empty real content.
export async function fetchFileAtRef(
  installationToken: string,
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<FileAtRefResult | null> {
  const res = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`,
    {
      headers: {
        Authorization: `Bearer ${installationToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      `Failed to fetch ${path}@${ref} (status ${res.status}): ${(body as { message?: string }).message ?? "unknown error"}`
    );
  }

  const body = (await res.json()) as { content?: string; encoding?: string };

  if (body.encoding !== "base64" || !body.content) {
    return { content: "", tooLarge: true };
  }

  const decoded = Buffer.from(body.content, "base64").toString("utf-8");
  return { content: decoded, binary: looksBinary(decoded) };
}

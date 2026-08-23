// backend/scripts/seed-eval-fixture.ts
//
// Idempotent seeding for the evaluation harness's dedicated fixture repo.
// Never touches dev-fixture-worker.ts or its data — this is a separate,
// standalone fixture under a clearly-namespaced owner ("codetrace-eval")
// so it can never collide with real user data or the /usage dashboard.
//
// Run with: npx tsx backend/scripts/seed-eval-fixture.ts

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/database/client.js";
import { env } from "../src/config/env.js";
import { embedQuery } from "../src/modules/chat/services/llm.service.js";
import { createSession } from "../src/modules/auth/services/session.service.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const FIXTURES_DIR = join(REPO_ROOT, "evaluation", "fixtures");
const DATASETS_DIR = join(REPO_ROOT, "evaluation", "datasets");
const MANIFEST_PATH = join(FIXTURES_DIR, "manifest.json");
const QA_PATH = join(DATASETS_DIR, "qa_questions.json");
const PR_SCENARIOS_PATH = join(DATASETS_DIR, "pr_scenarios.json");
const OUTPUT_PATH = join(REPO_ROOT, "evaluation", ".eval-fixture.json");

interface ManifestEntry {
  path: string;
  language: string;
  symbol: string;
  symbolType: "FUNCTION" | "METHOD" | "CLASS" | "INTERFACE";
  parentSymbol: string | null;
  startLine: number;
  endLine: number;
  calls: string[];
  bugCategory?: string;
}

interface QaQuestion {
  question: string;
  expectedChunks: Array<{ path: string; symbol: string }>;
}

interface PrScenario {
  name: string;
  filePath: string;
  startLine: number;
  endLine: number;
  category: "BUG" | "SECURITY" | "PERFORMANCE" | "LOGIC" | "TESTING" | "MAINTAINABILITY";
}

function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function findOrCreateEvalUser() {
  const existing = await prisma.user.findFirst({ where: { username: "codetrace-eval" } });
  if (existing) return existing;
  return prisma.user.create({
    data: { githubId: BigInt(999_999_001), username: "codetrace-eval", githubAccessToken: "eval-fixture-unused" },
  });
}

async function findOrCreateFixtureRepository(userId: string) {
  const existing = await prisma.repository.findFirst({ where: { owner: "codetrace-eval", name: "fixture-repo" } });
  if (existing) return existing;

  const installation = await prisma.repositoryInstallation.create({
    data: { userId, githubInstallationId: BigInt(999_999_001), permissions: {} },
  });
  return prisma.repository.create({
    data: {
      userId,
      installationId: installation.id,
      owner: "codetrace-eval",
      name: "fixture-repo",
      githubUrl: "https://github.com/codetrace-eval/fixture-repo",
      defaultBranch: "main",
      status: "INDEXED",
      currentCommitSha: "eval-fixture-sha",
    },
  });
}

async function seedFixtureChunks(repositoryId: string, manifest: ManifestEntry[]) {
  const chunkIdBySymbol = new Map<string, string>();
  const fileIdByPath = new Map<string, string>();

  for (const entry of manifest) {
    const fullContent = readFileSync(join(FIXTURES_DIR, "src", entry.path), "utf-8");
    const seededPath = `src/${entry.path}`;

    let fileId = fileIdByPath.get(seededPath);
    if (!fileId) {
      const file = await prisma.file.upsert({
        where: { repositoryId_path: { repositoryId, path: seededPath } },
        create: {
          repositoryId,
          path: seededPath,
          language: entry.language,
          contentHash: contentHash(fullContent),
          sizeBytes: fullContent.length,
          lastIndexedSha: "eval-fixture-sha",
        },
        update: { contentHash: contentHash(fullContent), sizeBytes: fullContent.length },
      });
      fileId = file.id;
      fileIdByPath.set(seededPath, fileId);
    }

    const lines = fullContent.split("\n");
    const chunkContent = lines.slice(entry.startLine - 1, entry.endLine).join("\n");
    const hash = contentHash(chunkContent);

    const existingEmbedding = await prisma.embedding.findUnique({
      where: { contentHash_modelVersion: { contentHash: hash, modelVersion: env.EMBEDDING_MODEL_VERSION } },
    });
    if (!existingEmbedding) {
      const vector = await embedQuery(chunkContent);
      await prisma.$executeRaw`
        INSERT INTO embeddings (content_hash, model_version, vector, created_at)
        VALUES (${hash}, ${env.EMBEDDING_MODEL_VERSION}, ${`[${vector.join(",")}]`}::vector, now())
        ON CONFLICT (content_hash, model_version) DO NOTHING
      `;
    }

    const existingChunk = await prisma.chunk.findFirst({ where: { fileId, symbol: entry.symbol } });
    const chunk = existingChunk
      ? existingChunk
      : await prisma.chunk.create({
          data: {
            repositoryId,
            fileId,
            symbol: entry.symbol,
            symbolType: entry.symbolType,
            parentSymbol: entry.parentSymbol,
            language: entry.language,
            startLine: entry.startLine,
            endLine: entry.endLine,
            content: chunkContent,
            contentHash: hash,
            embeddingModelVersion: env.EMBEDDING_MODEL_VERSION,
          },
        });
    chunkIdBySymbol.set(entry.symbol, chunk.id);
  }

  // Relationships: reinsert-clean each run (cheap, small fixed set) rather
  // than trying to diff — simpler than upserting a compound-key-less table.
  await prisma.symbolRelationship.deleteMany({ where: { repositoryId } });
  for (const entry of manifest) {
    const fromChunkId = chunkIdBySymbol.get(entry.symbol);
    if (!fromChunkId) continue;
    for (const calledSymbol of entry.calls) {
      const toChunkId = chunkIdBySymbol.get(calledSymbol);
      await prisma.symbolRelationship.create({
        data: {
          repositoryId,
          fromChunkId,
          toChunkId: toChunkId ?? null,
          relationshipType: "CALLS",
          externalTarget: toChunkId ? null : calledSymbol,
        },
      });
    }
  }
}

async function seedQaQuestions(repositoryId: string, questions: QaQuestion[]) {
  for (const q of questions) {
    const existing = await prisma.evalQuestion.findFirst({ where: { repositoryId, question: q.question } });
    if (existing) continue;
    await prisma.evalQuestion.create({
      data: { repositoryId, question: q.question, expectedChunks: q.expectedChunks },
    });
  }
}

async function seedPrScenarios(repositoryId: string, scenarios: PrScenario[]): Promise<Record<string, string>> {
  const pullRequestIds: Record<string, string> = {};
  for (const [index, scenario] of scenarios.entries()) {
    const githubPrNumber = index + 1;
    const existing = await prisma.pullRequest.findUnique({
      where: { repositoryId_githubPrNumber: { repositoryId, githubPrNumber } },
    });
    const pr = existing
      ? existing
      : await prisma.pullRequest.create({
          data: {
            repositoryId,
            githubPrNumber,
            title: scenario.name,
            author: "codetrace-eval-bot",
            baseSha: "eval-fixture-sha",
            headSha: "eval-fixture-sha",
          },
        });
    pullRequestIds[scenario.name] = pr.id;
  }
  return pullRequestIds;
}

async function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8")) as ManifestEntry[];
  const qaQuestions = JSON.parse(readFileSync(QA_PATH, "utf-8")) as QaQuestion[];
  const prScenarios = JSON.parse(readFileSync(PR_SCENARIOS_PATH, "utf-8")) as PrScenario[];

  const user = await findOrCreateEvalUser();
  const repository = await findOrCreateFixtureRepository(user.id);

  console.log(`Seeding ${manifest.length} chunks (real embeddings — this calls the Gemini API)...`);
  await seedFixtureChunks(repository.id, manifest);

  console.log(`Seeding ${qaQuestions.length} QA questions...`);
  await seedQaQuestions(repository.id, qaQuestions);

  console.log(`Seeding ${prScenarios.length} PR scenarios...`);
  const pullRequestIds = await seedPrScenarios(repository.id, prScenarios);

  const { accessToken } = await createSession(user.id, {});

  writeFileSync(
    OUTPUT_PATH,
    JSON.stringify({ token: accessToken, repositoryId: repository.id, pullRequestIds }, null, 2)
  );
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    return prisma.$disconnect().finally(() => process.exit(1));
  });

import { createHash } from "node:crypto";
import { Worker, type Job } from "bullmq";
import { prisma } from "../src/database/client.js";
import { env } from "../src/config/env.js";
import { INDEX_JOB_QUEUE } from "../src/queues/index.js";
import { SAMPLE_CHUNKS } from "./fixtures/sample-chunks.js";
import type { IndexJobPayload } from "@codetrace/shared-types";

function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

// Deterministic fake vector — real embeddings come from the Gemini API in
// the actual worker (out of scope for this plan). 1536 dims to match the
// schema's vector(1536) column.
function fakeVector(seed: string): number[] {
  const hash = createHash("sha256").update(seed).digest();
  const vec: number[] = [];
  for (let i = 0; i < 1536; i++) {
    vec.push((hash[i % hash.length] / 255) * 2 - 1);
  }
  return vec;
}

export async function processFixtureIndexJob(repositoryId: string): Promise<void> {
  await prisma.repository.update({ where: { id: repositoryId }, data: { status: "EMBEDDING" } });

  const modelVersion = env.EMBEDDING_MODEL_VERSION;
  const chunkIdBySymbol = new Map<string, string>();
  const fileIdByPath = new Map<string, string>();

  for (const fixture of SAMPLE_CHUNKS) {
    let fileId = fileIdByPath.get(fixture.path);
    if (!fileId) {
      const file = await prisma.file.create({
        data: {
          repositoryId,
          path: fixture.path,
          language: fixture.language,
          contentHash: contentHash(fixture.path),
          sizeBytes: fixture.content.length,
          lastIndexedSha: "fixture-sha",
        },
      });
      fileId = file.id;
      fileIdByPath.set(fixture.path, fileId);
    }

    const hash = contentHash(fixture.content);

    // Worker invariant (docs/database.md): embeddings are upserted BEFORE
    // chunks — the chunk -> embedding FK requires the row to already exist.
    const vector = fakeVector(hash);
    await prisma.$executeRaw`
      INSERT INTO embeddings (content_hash, model_version, vector, created_at)
      VALUES (${hash}, ${modelVersion}, ${`[${vector.join(",")}]`}::vector, now())
      ON CONFLICT (content_hash, model_version) DO NOTHING
    `;

    const chunk = await prisma.chunk.create({
      data: {
        repositoryId,
        fileId,
        symbol: fixture.symbol,
        symbolType: fixture.symbolType,
        parentSymbol: fixture.parentSymbol,
        language: fixture.language,
        startLine: fixture.startLine,
        endLine: fixture.endLine,
        content: fixture.content,
        contentHash: hash,
        embeddingModelVersion: modelVersion,
      },
    });
    chunkIdBySymbol.set(fixture.symbol, chunk.id);
  }

  for (const fixture of SAMPLE_CHUNKS) {
    const fromChunkId = chunkIdBySymbol.get(fixture.symbol);
    if (!fromChunkId) continue;

    for (const calledSymbol of fixture.calls) {
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

  await prisma.repository.update({
    where: { id: repositoryId },
    data: {
      status: "INDEXED",
      currentCommitSha: "fixture-sha",
      filesIndexed: fileIdByPath.size,
      chunksIndexed: SAMPLE_CHUNKS.length,
    },
  });
}

export function startFixtureWorker(): Worker<IndexJobPayload> {
  return new Worker<IndexJobPayload>(
    INDEX_JOB_QUEUE,
    async (job: Job<IndexJobPayload>) => {
      await processFixtureIndexJob(job.data.repositoryId);
    },
    { connection: { url: env.REDIS_URL } }
  );
}

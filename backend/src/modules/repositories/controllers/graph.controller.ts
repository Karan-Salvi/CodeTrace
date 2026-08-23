import type { Request, Response } from "express";
import { graphQuerySchema } from "../validators/graph.validators.js";
import { getOwnedRepository } from "../services/repository.service.js";
import { aggregateFileGraph, buildSymbolGraph, type FileRelationshipRow, type FileChunkRow, type SymbolChunkRef, type OutgoingEdgeRow, type IncomingEdgeRow } from "../services/graph.service.js";
import { AppError } from "../../../core/errors/app-error.js";
import { sendSuccess } from "../../../core/utils/response.js";
import { prisma } from "../../../database/client.js";

export async function getRepositoryGraph(req: Request, res: Response) {
  const repository = await getOwnedRepository(req.user!.id, req.params.id as string);

  const parsed = graphQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw AppError.badRequest("INVALID_INPUT", parsed.error.message);
  }

  if (parsed.data.scope === "file") {
    const relationshipRows = await prisma.symbolRelationship.findMany({
      where: { repositoryId: repository.id },
      select: {
        relationshipType: true,
        fromChunkId: true,
        fromChunk: { select: { fileId: true, file: { select: { path: true } } } },
        toChunkId: true,
        toChunk: { select: { fileId: true, file: { select: { path: true } } } },
      },
    });
    const relationships: FileRelationshipRow[] = relationshipRows.map((r) => ({
      relationshipType: r.relationshipType,
      fromChunkId: r.fromChunkId,
      fromFileId: r.fromChunk.fileId,
      fromFilePath: r.fromChunk.file.path,
      toChunkId: r.toChunkId,
      toFileId: r.toChunk?.fileId ?? null,
      toFilePath: r.toChunk?.file.path ?? null,
    }));

    const chunkRows = await prisma.chunk.findMany({
      where: { repositoryId: repository.id },
      select: { id: true, symbol: true, fileId: true, file: { select: { path: true } } },
    });
    const chunks: FileChunkRow[] = chunkRows.map((c) => ({
      fileId: c.fileId,
      filePath: c.file.path,
      chunkId: c.id,
      symbol: c.symbol,
    }));

    const graph = aggregateFileGraph(relationships, chunks);
    sendSuccess(res, { scope: "file" as const, ...graph });
    return;
  }

  // scope === "symbol" — graphQuerySchema's refine guarantees root is set here.
  const rootId = parsed.data.root!;
  const rootChunk = await prisma.chunk.findFirst({
    where: { id: rootId, repositoryId: repository.id },
    select: { id: true, symbol: true, symbolType: true, startLine: true, file: { select: { path: true } } },
  });
  if (!rootChunk) {
    throw AppError.notFound("Symbol not found");
  }
  const rootRef: SymbolChunkRef = {
    id: rootChunk.id,
    symbol: rootChunk.symbol,
    symbolType: rootChunk.symbolType,
    filePath: rootChunk.file.path,
    startLine: rootChunk.startLine,
  };

  const [outgoingRows, incomingRows] = await Promise.all([
    prisma.symbolRelationship.findMany({
      where: { fromChunkId: rootId },
      select: {
        relationshipType: true,
        externalTarget: true,
        toChunk: { select: { id: true, symbol: true, symbolType: true, startLine: true, file: { select: { path: true } } } },
      },
    }),
    prisma.symbolRelationship.findMany({
      where: { toChunkId: rootId },
      select: {
        relationshipType: true,
        fromChunk: { select: { id: true, symbol: true, symbolType: true, startLine: true, file: { select: { path: true } } } },
      },
    }),
  ]);

  const outgoing: OutgoingEdgeRow[] = outgoingRows.map((r) => ({
    relationshipType: r.relationshipType,
    externalTarget: r.externalTarget,
    target: r.toChunk
      ? { id: r.toChunk.id, symbol: r.toChunk.symbol, symbolType: r.toChunk.symbolType, filePath: r.toChunk.file.path, startLine: r.toChunk.startLine }
      : null,
  }));
  const incoming: IncomingEdgeRow[] = incomingRows.map((r) => ({
    relationshipType: r.relationshipType,
    source: { id: r.fromChunk.id, symbol: r.fromChunk.symbol, symbolType: r.fromChunk.symbolType, filePath: r.fromChunk.file.path, startLine: r.fromChunk.startLine },
  }));

  const graph = buildSymbolGraph(rootRef, outgoing, incoming);
  sendSuccess(res, { scope: "symbol" as const, root: rootId, ...graph });
}

import type { Request, Response } from "express";
import { connectRepositorySchema } from "../validators/repository.validators.js";
import {
  connectRepository,
  listRepositories,
  deleteRepository,
} from "../services/repository.service.js";
import { AppError } from "../../../core/errors/app-error.js";
import { sendSuccess } from "../../../core/utils/response.js";

export async function postRepository(req: Request, res: Response) {
  const parsed = connectRepositorySchema.safeParse(req.body);
  if (!parsed.success) {
    throw AppError.badRequest("INVALID_INPUT", parsed.error.message);
  }
  const repository = await connectRepository(req.user!.id, parsed.data);
  sendSuccess(res, repository, 201);
}

export async function getRepositories(req: Request, res: Response) {
  const repositories = await listRepositories(req.user!.id);
  sendSuccess(res, repositories);
}

export async function deleteRepositoryHandler(req: Request, res: Response) {
  await deleteRepository(req.user!.id, req.params.id as string);
  sendSuccess(res, { deleted: true });
}

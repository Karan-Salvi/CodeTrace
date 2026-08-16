import type { Request, Response } from "express";
import { AppError } from "../../../core/errors/app-error.js";
import { sendSuccess } from "../../../core/utils/response.js";
import { triggerIndexParamsSchema } from "../validators/indexing.validators.js";
import { triggerFullIndex } from "../services/index-job.service.js";

export async function postTriggerIndex(req: Request, res: Response) {
  const parsed = triggerIndexParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    throw AppError.badRequest("INVALID_INPUT", parsed.error.message);
  }
  const indexJob = await triggerFullIndex(req.user!.id, parsed.data.id);
  sendSuccess(res, indexJob, 202);
}

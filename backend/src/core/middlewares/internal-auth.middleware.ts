import type { NextFunction, Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";
import { AppError } from "../errors/app-error.js";

export function requireInternalAuth(req: Request, _res: Response, next: NextFunction) {
  const provided = req.headers["x-internal-secret"] as string | undefined;
  if (!provided) {
    return next(AppError.unauthorized("Missing internal secret"));
  }

  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(env.INTERNAL_API_SECRET);

  if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
    return next(AppError.unauthorized("Invalid internal secret"));
  }

  next();
}

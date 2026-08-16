import type { NextFunction, Request, Response } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";
import { AppError } from "../errors/app-error.js";

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

export function verifyWebhookSignature(req: RequestWithRawBody, _res: Response, next: NextFunction) {
  const signature = req.headers["x-hub-signature-256"] as string | undefined;
  if (!signature || !req.rawBody) {
    return next(AppError.unauthorized("Missing webhook signature"));
  }

  const expected =
    "sha256=" + createHmac("sha256", env.GITHUB_WEBHOOK_SECRET).update(req.rawBody).digest("hex");

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);

  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return next(AppError.unauthorized("Invalid webhook signature"));
  }

  next();
}

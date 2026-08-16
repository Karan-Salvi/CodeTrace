import type { NextFunction, Request, Response } from "express";
import { AppError } from "./app-error.js";
import { sendError } from "../utils/response.js";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return sendError(res, err.statusCode, err.code, err.message);
  }

  const message = err instanceof Error ? err.message : "Unknown error";
  console.error(`[${req.id ?? "no-request-id"}] Unhandled error:`, err);
  return sendError(res, 500, "INTERNAL_ERROR", message);
}

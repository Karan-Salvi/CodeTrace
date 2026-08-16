import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../../modules/auth/services/session.service.js";
import { AppError } from "../errors/app-error.js";

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(AppError.unauthorized("Missing bearer token"));
  }

  const token = header.slice("Bearer ".length);
  const payload = verifyAccessToken(token);
  if (!payload) {
    return next(AppError.unauthorized("Invalid or expired token"));
  }

  req.user = { id: payload.userId, sessionId: payload.sessionId };
  next();
}

import type { Request, Response, NextFunction } from "express";
import { env } from "../../config/env.js";
import { AppError } from "../errors/app-error.js";

export function requireOperator(req: Request, _res: Response, next: NextFunction): void {
  const operatorId = env.OPERATOR_USER_ID;

  if (!operatorId || !req.user || req.user.id !== operatorId) {
    return next(AppError.forbidden("Not authorized to view usage data"));
  }

  next();
}

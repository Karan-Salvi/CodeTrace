import type { Request, Response, NextFunction } from "express";
import { env } from "../../config/env.js";

export function requireOperator(req: Request, res: Response, next: NextFunction): void {
  const operatorId = env.OPERATOR_USER_ID;

  if (!operatorId || !req.user || req.user.id !== operatorId) {
    res.status(403).json({ error: "Forbidden: operator access required" });
    return;
  }

  next();
}

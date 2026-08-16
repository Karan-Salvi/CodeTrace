import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  req.id = (req.headers["x-request-id"] as string) || randomUUID();
  res.setHeader("x-request-id", req.id);

  const start = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - start;
    console.log(
      JSON.stringify({
        requestId: req.id,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs,
      })
    );
  });

  next();
}

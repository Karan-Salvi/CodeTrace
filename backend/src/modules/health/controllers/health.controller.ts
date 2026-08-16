import type { Request, Response } from "express";
import { prisma } from "../../../database/client.js";
import { redis } from "../../../config/redis.js";

export async function getHealth(_req: Request, res: Response) {
  res.status(200).json({ status: "healthy" });
}

export async function getHealthDb(_req: Request, res: Response) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ database: "healthy" });
  } catch {
    res.status(503).json({ database: "unhealthy" });
  }
}

export async function getHealthRedis(_req: Request, res: Response) {
  try {
    const pong = await redis.ping();
    res.status(pong === "PONG" ? 200 : 503).json({
      redis: pong === "PONG" ? "healthy" : "unhealthy",
    });
  } catch {
    res.status(503).json({ redis: "unhealthy" });
  }
}

import { Router } from "express";
import { getHealth, getHealthDb, getHealthRedis } from "../controllers/health.controller.js";

export const healthRoutes = Router();

healthRoutes.get("/health", getHealth);
healthRoutes.get("/health/db", getHealthDb);
healthRoutes.get("/health/redis", getHealthRedis);

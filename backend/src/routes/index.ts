import { Router } from "express";
import { healthRoutes } from "../modules/health/routes/health.routes.js";
import { authRoutes } from "../modules/auth/routes/auth.routes.js";
import { repositoriesRoutes } from "../modules/repositories/routes/repositories.routes.js";
import { webhooksRoutes } from "../modules/webhooks/routes/webhooks.routes.js";
import { chatRoutes } from "../modules/chat/routes/chat.routes.js";
import { prReviewRoutes } from "../modules/pr-review/routes/pr-review.routes.js";
import { evaluationRoutes } from "../modules/evaluation/routes/evaluation.routes.js";
import { indexingRoutes } from "../modules/indexing/routes/indexing.routes.js";
import { usageRoutes } from "../modules/usage/routes/usage.routes.js";

export const rootRouter = Router();

rootRouter.use(healthRoutes);
rootRouter.use(authRoutes);
rootRouter.use(repositoriesRoutes);
rootRouter.use(webhooksRoutes);
rootRouter.use(chatRoutes);
rootRouter.use(prReviewRoutes);
rootRouter.use(evaluationRoutes);
rootRouter.use(indexingRoutes);
rootRouter.use(usageRoutes);

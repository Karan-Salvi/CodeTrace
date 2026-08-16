import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { requestLogger } from "./core/middlewares/request-logger.middleware.js";
import { errorHandler } from "./core/errors/error-handler.js";
import { rootRouter } from "./routes/index.js";
import { env } from "./config/env.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  // security.md: refresh-token cookie means CORS credentials must be
  // paired with an explicit origin, never the package's "*" default —
  // see CORS_ORIGIN's comment in config/env.ts for why.
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as unknown as Request & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(cookieParser());
  app.use(requestLogger);

  app.use(rootRouter);

  app.use(errorHandler);

  return app;
}

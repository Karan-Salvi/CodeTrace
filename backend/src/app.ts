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

  // This backend is a pure JSON API with no cacheable content — every
  // response is either user-scoped or auth-sensitive (repositories, /me,
  // /auth/refresh). Express's default ETag generation still applies to
  // ALL responses including error ones, and with no explicit
  // Cache-Control, the browser's normal HTTP cache heuristics can serve a
  // stale cached response (a stale 401 included) instead of hitting the
  // network on the next request. Confirmed as the actual cause of "works
  // with DevTools' Disable Cache on, breaks with it off": disabling both
  // outright removes any chance of the browser reusing a prior response.
  app.set("etag", false);
  app.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

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

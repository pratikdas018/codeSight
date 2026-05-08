import compression from "compression";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import executionRoutes from "./routes/executionRoutes";

const app = express();

const isOriginAllowed = (origin?: string) =>
  !origin ||
  env.frontendOrigins.length === 0 ||
  env.frontendOrigins.includes(origin);

const executeLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  limit: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many execution requests. Please wait a moment and try again.",
  },
});

app.disable("x-powered-by");
app.set("trust proxy", env.trustProxy);
app.use(
  pinoHttp({
    level: env.logLevel,
    quietReqLogger: !env.isProduction,
  }),
);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(
  cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed by CORS."));
    },
    credentials: true,
  }),
);
app.use(compression());
app.use(express.json({ limit: env.bodyLimit }));

app.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "api",
    executorMode: env.executorMode,
  });
});

app.use("/execute", executeLimiter);
app.use(executionRoutes);

app.use(
  (
    error: Error,
    _request: express.Request,
    response: express.Response,
    next: express.NextFunction,
  ) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    if (error.message.includes("Origin not allowed by CORS")) {
      response.status(403).json({ message: error.message });
      return;
    }

    response.status(500).json({
      message: env.isProduction
        ? "Internal server error."
        : error.message,
    });
  },
);

app.use((_request, response) => {
  response.status(404).json({ message: "Route not found." });
});

export default app;

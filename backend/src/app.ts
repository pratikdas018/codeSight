import compression from "compression";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import executionRoutes from "./routes/executionRoutes";
import {
  getRuntimeManagerSnapshot,
  primeRuntimeManagerSnapshot,
} from "./services/runtimeManagerService";

const app = express();
primeRuntimeManagerSnapshot();

const isOriginAllowed = (origin?: string) =>
  !origin ||
  env.frontendOrigins.length === 0 ||
  env.frontendOrigins.includes(origin);

const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin not allowed by CORS."));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

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
app.options("*", cors(corsOptions));
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: env.bodyLimit }));

app.get("/health", async (_request, response, next) => {
  try {
    const runtimeManager = await getRuntimeManagerSnapshot();

    response.json({
      status: "ok",
      service: "api",
      executorMode: env.executorMode,
      executionProvider: env.executionProvider,
      runtimeManager,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/runtimes", async (request, response, next) => {
  try {
    const refreshRequested =
      request.query.refresh === "1" || request.query.refresh === "true";
    const runtimeManager = await getRuntimeManagerSnapshot({
      refresh: refreshRequested,
    });

    response.json(runtimeManager);
  } catch (error) {
    next(error);
  }
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

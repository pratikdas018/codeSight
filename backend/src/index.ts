import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { env } from "./config/env";
import { startHttpServer } from "./utils/server";

const startServer = async () => {
  try {
    const server = await startHttpServer(app, env.port, "CodeSight backend");
    const shutdown = (signal: string) => {
      console.log(`Received ${signal}; draining backend requests.`);
      server.close((error) => {
        if (error) {
          console.error("Backend shutdown failed.", error);
          process.exitCode = 1;
        }
        process.exit();
      });
    };
    process.once("SIGTERM", () => shutdown("SIGTERM"));
    process.once("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown startup error.";
    console.error(`Unable to start CodeSight backend: ${message}`);
    process.exit(1);
  }
};

void startServer();

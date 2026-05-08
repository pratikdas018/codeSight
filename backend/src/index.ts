import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { env } from "./config/env";
import { startHttpServer } from "./utils/server";

const startServer = async () => {
  try {
    await startHttpServer(app, env.port, "CodeSight backend");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown startup error.";
    console.error(`Unable to start CodeSight backend: ${message}`);
    process.exit(1);
  }
};

void startServer();

import dotenv from "dotenv";
dotenv.config();

import { env, requireExecutorSecret } from "./config/env";
import executorApp from "./executorApp";
import { startHttpServer } from "./utils/server";

const startExecutor = async () => {
  try {
    requireExecutorSecret();
    await startHttpServer(executorApp, env.port, "CodeSight executor");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown startup error.";
    console.error(`Unable to start CodeSight executor: ${message}`);
    process.exit(1);
  }
};

void startExecutor();

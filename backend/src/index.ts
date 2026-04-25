import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { prisma } from "./services/prisma";

const requiredEnvVars = ["DATABASE_URL", "JWT_SECRET"];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`${envVar} is required in backend/.env`);
  }
}

const port = Number(process.env.PORT ?? 4000);

let server: ReturnType<typeof app.listen> | null = null;

const startServer = async () => {
  try {
    await prisma.$connect();

    server = app.listen(port, () => {
      console.log(`CodeSight backend listening on http://localhost:${port}`);
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown startup error.";
    console.error(`Unable to start CodeSight backend: ${message}`);
    process.exit(1);
  }
};

const shutdown = async () => {
  if (!server) {
    await prisma.$disconnect();
    process.exit(0);
  }

  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

void startServer();

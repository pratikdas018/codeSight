const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required in backend/.env");
}

if (!databaseUrl.startsWith("file:")) {
  throw new Error("SQLite bootstrap only supports file: DATABASE_URL values.");
}

const relativeOrAbsolutePath = databaseUrl.slice("file:".length);
const windowsAbsolutePathMatch = /^\/[a-zA-Z]:\//.test(relativeOrAbsolutePath);
const normalizedPath = windowsAbsolutePathMatch
  ? relativeOrAbsolutePath.slice(1)
  : relativeOrAbsolutePath;
const dbPath = path.isAbsolute(normalizedPath)
  ? normalizedPath
  : path.resolve(__dirname, "..", "prisma", normalizedPath);

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);

const getColumnNames = (tableName) =>
  db
    .prepare(`PRAGMA table_info("${tableName}")`)
    .all()
    .map((column) => column.name);

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "email" TEXT NOT NULL,
      "password" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS "CodeSnippet" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "language" TEXT NOT NULL DEFAULT 'javascript',
      "code" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CodeSnippet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );

  CREATE TABLE IF NOT EXISTS "ExecutionHistory" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "codeSnippetId" TEXT NOT NULL,
      "output" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ExecutionHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "ExecutionHistory_codeSnippetId_fkey" FOREIGN KEY ("codeSnippetId") REFERENCES "CodeSnippet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );

  CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
  CREATE INDEX IF NOT EXISTS "CodeSnippet_userId_createdAt_idx" ON "CodeSnippet"("userId", "createdAt");
  CREATE INDEX IF NOT EXISTS "ExecutionHistory_userId_createdAt_idx" ON "ExecutionHistory"("userId", "createdAt");
  CREATE INDEX IF NOT EXISTS "ExecutionHistory_codeSnippetId_idx" ON "ExecutionHistory"("codeSnippetId");
`);

if (!getColumnNames("CodeSnippet").includes("language")) {
  db.exec(
    `ALTER TABLE "CodeSnippet" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'javascript';`,
  );
}

db.close();

console.log(`SQLite schema ready at ${dbPath}`);

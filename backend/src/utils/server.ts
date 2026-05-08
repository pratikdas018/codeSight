import type { Express } from "express";

export const startHttpServer = (
  app: Express,
  port: number,
  label: string,
  host?: string,
) =>
  new Promise<void>((resolve, reject) => {
    const server = host
      ? app.listen(port, host, () => resolve())
      : app.listen(port, () => resolve());

    server.on("error", reject);
    server.on("listening", () => {
      console.log(`${label} listening on http://${host ?? "0.0.0.0"}:${port}`);
    });
  });

import type { Express } from "express";
import type { Server } from "node:http";

export const startHttpServer = (
  app: Express,
  port: number,
  label: string,
  host?: string,
) : Promise<Server> =>
  new Promise<Server>((resolve, reject) => {
    const server = host
      ? app.listen(port, host, () => resolve(server))
      : app.listen(port, () => resolve(server));

    server.on("error", reject);
    server.on("listening", () => {
      console.log(`${label} listening on http://${host ?? "0.0.0.0"}:${port}`);
    });
  });

import { Cpu, Server, Wifi } from "lucide-react";
import type { SystemHealthSnapshot } from "../../types/admin";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

export const SystemHealthPanel = ({ health }: { health: SystemHealthSnapshot }) => (
  <Card className="h-full">
    <CardHeader>
      <CardTitle>System Health</CardTitle>
      <CardDescription>
        Runtime environment, backend availability, and renderer network status.
      </CardDescription>
    </CardHeader>
    <CardContent className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
      <div className="min-w-0 rounded-2xl border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] p-4">
        <div className="flex items-center gap-2 text-[var(--cs-text)]">
          <Server className="h-4 w-4 text-[var(--cs-primary)]" />
          Backend
        </div>
        <div className="mt-3">
          <Badge
            variant={health.backendConnection === "online" ? "success" : "danger"}
            className="w-fit whitespace-nowrap"
          >
            {health.backendConnection}
          </Badge>
        </div>
      </div>

      <div className="min-w-0 rounded-2xl border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] p-4 sm:col-span-2 2xl:col-span-1">
        <div className="flex items-center gap-2 text-[var(--cs-text)]">
          <Cpu className="h-4 w-4 text-[var(--cs-primary)]" />
          Runtime
        </div>
        <p className="mt-3 break-words text-sm leading-6 text-[var(--cs-text-muted)]">
          {health.executionProvider} in {health.executorMode} mode
        </p>
        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">
          {health.runtimeInstalledCount} installed · {health.runtimeMissingCount} missing
        </p>
      </div>

      <div className="min-w-0 rounded-2xl border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] p-4">
        <div className="flex items-center gap-2 text-[var(--cs-text)]">
          <Wifi className="h-4 w-4 text-[var(--cs-primary)]" />
          Renderer
        </div>
        <div className="mt-3">
          <Badge variant={health.rendererOnline ? "info" : "warning"} className="w-fit whitespace-nowrap">
            {health.rendererOnline ? "online" : "offline"}
          </Badge>
        </div>
      </div>
    </CardContent>
  </Card>
);

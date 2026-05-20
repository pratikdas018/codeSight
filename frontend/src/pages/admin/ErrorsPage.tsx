import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { fetchCrashReports, fetchRecentExecutionLogs } from "../../services/adminService";
import { useRealtimeMetrics } from "../../hooks/useRealtimeMetrics";
import type { AdminLayoutOutletContext } from "./AdminLayout";
import type { CrashReportRecord, ExecutionLogRecord } from "../../types/admin";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";

export const ErrorsPage = () => {
  const { searchQuery } = useOutletContext<AdminLayoutOutletContext>();
  const [crashes, setCrashes] = useState<CrashReportRecord[] | null>(null);
  const [failures, setFailures] = useState<ExecutionLogRecord[] | null>(null);

  const load = useCallback(async () => {
    const [crashRows, executionRows] = await Promise.all([
      fetchCrashReports(),
      fetchRecentExecutionLogs(),
    ]);
    setCrashes(crashRows);
    setFailures(executionRows.filter((entry) => !entry.success));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeMetrics(() => {
    void load();
  });

  const filteredCrashes = useMemo(
    () =>
      (crashes ?? []).filter((row) =>
        searchQuery
          ? `${row.errorMessage} ${row.language ?? ""} ${row.severity}`.toLowerCase().includes(searchQuery.toLowerCase())
          : true,
      ),
    [crashes, searchQuery],
  );

  const failingLanguage = useMemo(() => {
    const tally = new Map<string, number>();
    for (const failure of failures ?? []) {
      tally.set(failure.language, (tally.get(failure.language) ?? 0) + 1);
    }
    return [...tally.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "none";
  }, [failures]);

  if (!crashes || !failures) {
    return <Skeleton className="h-[760px]" />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-5"><div className="text-xs uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">Crash reports</div><div className="mt-3 text-3xl font-semibold">{filteredCrashes.length}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">Execution failures</div><div className="mt-3 text-3xl font-semibold">{failures.length}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">Most failing language</div><div className="mt-3 text-3xl font-semibold">{failingLanguage}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Error monitoring</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {filteredCrashes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--cs-border)] p-5 text-sm text-[var(--cs-text-muted)]">
              No crash reports match the current filters.
            </div>
          ) : (
            filteredCrashes.map((crash) => (
              <div key={crash.id} className="rounded-[1.5rem] border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={crash.severity === "critical" ? "danger" : crash.severity === "warning" ? "warning" : "info"}>
                        {crash.severity}
                      </Badge>
                      <Badge>{crash.language ?? "unknown runtime"}</Badge>
                    </div>
                    <h3 className="mt-3 text-base font-medium text-[var(--cs-text)]">{crash.errorMessage}</h3>
                    <p className="mt-2 text-sm text-[var(--cs-text-muted)]">{new Date(crash.createdAt).toLocaleString()}</p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => void navigator.clipboard.writeText(crash.stackTrace ?? crash.errorMessage)}
                  >
                    <Copy className="h-4 w-4" />
                    Copy stack
                  </Button>
                </div>
                <pre className="mt-4 overflow-auto rounded-2xl border border-[var(--cs-border)] bg-[#050505] p-4 font-mono text-xs leading-6 text-[var(--cs-text-muted)]">
                  {crash.stackTrace || "No stack trace captured."}
                </pre>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { fetchRecentExecutionLogs } from "../../services/adminService";
import { useRealtimeMetrics } from "../../hooks/useRealtimeMetrics";
import type { AdminLayoutOutletContext } from "./AdminLayout";
import type { ExecutionLogRecord } from "../../types/admin";
import { CodePreviewDialog } from "../../components/admin/CodePreviewDialog";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Skeleton } from "../../components/ui/skeleton";

export const ExecutionsPage = () => {
  const { searchQuery } = useOutletContext<AdminLayoutOutletContext>();
  const [rows, setRows] = useState<ExecutionLogRecord[] | null>(null);
  const [selected, setSelected] = useState<ExecutionLogRecord | null>(null);

  const load = useCallback(async () => {
    setRows(await fetchRecentExecutionLogs());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeMetrics(() => {
    void load();
  });

  const filtered = useMemo(
    () =>
      (rows ?? []).filter((row) =>
        searchQuery
          ? `${row.language} ${row.runtimeStatus} ${row.errorMessage ?? ""}`.toLowerCase().includes(searchQuery.toLowerCase())
          : true,
      ),
    [rows, searchQuery],
  );

  if (!rows) {
    return <Skeleton className="h-[760px]" />;
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Execution monitoring</CardTitle>
            <p className="text-sm text-[var(--cs-text-muted)]">Recent executions, timing, compile/runtime issues, and code previews.</p>
          </div>
          <Button variant="secondary" onClick={() => setRows([...filtered].reverse())}>
            Toggle order
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Language</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Execution</TableHead>
                <TableHead>Compile</TableHead>
                <TableHead>Trace</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.language}</TableCell>
                  <TableCell>
                    <Badge variant={row.success ? "success" : row.runtimeStatus === "timeout" ? "warning" : "danger"}>
                      {row.runtimeStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.executionTime}ms</TableCell>
                  <TableCell>{row.compileTime}ms</TableCell>
                  <TableCell>{row.traceTime}ms</TableCell>
                  <TableCell>
                    <Button variant="ghost" onClick={() => setSelected(row)}>
                      Preview
                    </Button>
                  </TableCell>
                  <TableCell className="max-w-[320px] truncate">{row.errorMessage ?? "No error"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <CodePreviewDialog
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
        title="Execution code preview"
        description={selected ? `${selected.language} · ${selected.executionTime}ms · ${selected.runtimeStatus}` : ""}
        code={selected?.codePreview ?? ""}
      />
    </>
  );
};

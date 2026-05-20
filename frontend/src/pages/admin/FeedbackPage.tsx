import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { exportRecords, fetchFeedbackReports, updateFeedbackReportStatus } from "../../services/adminService";
import { useRealtimeMetrics } from "../../hooks/useRealtimeMetrics";
import type { AdminLayoutOutletContext } from "./AdminLayout";
import type { FeedbackReportRecord } from "../../types/admin";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Textarea } from "../../components/ui/textarea";
import { Skeleton } from "../../components/ui/skeleton";

export const FeedbackPage = () => {
  const { searchQuery } = useOutletContext<AdminLayoutOutletContext>();
  const [rows, setRows] = useState<FeedbackReportRecord[] | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const nextRows = await fetchFeedbackReports();
    setRows(nextRows);
    setNotesById(
      nextRows.reduce<Record<string, string>>((accumulator, row) => {
        accumulator[row.id] = row.adminNotes ?? "";
        return accumulator;
      }, {}),
    );
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
          ? `${row.message} ${row.type} ${row.status}`.toLowerCase().includes(searchQuery.toLowerCase())
          : true,
      ),
    [rows, searchQuery],
  );

  if (!rows) {
    return <Skeleton className="h-[760px]" />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Feedback center</CardTitle>
          <p className="text-sm text-[var(--cs-text-muted)]">Bug reports, feature requests, and admin resolution workflow.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => exportRecords(filtered, "csv", "codesight-feedback")}>Export CSV</Button>
          <Button variant="secondary" onClick={() => exportRecords(filtered, "json", "codesight-feedback")}>Export JSON</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--cs-border)] p-5 text-sm text-[var(--cs-text-muted)]">
            No feedback reports match the current search.
          </div>
        ) : (
          filtered.map((row) => (
            <div key={row.id} className="rounded-[1.5rem] border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={row.status === "resolved" ? "success" : row.status === "in_review" ? "warning" : "info"}>
                      {row.status}
                    </Badge>
                    <Badge>{row.type}</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-[var(--cs-text)]">{row.message}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">
                    {new Date(row.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => void updateFeedbackReportStatus({ id: row.id, status: "in_review", adminNotes: notesById[row.id] ?? "" }).then(load)}>
                    Mark review
                  </Button>
                  <Button onClick={() => void updateFeedbackReportStatus({ id: row.id, status: "resolved", adminNotes: notesById[row.id] ?? "" }).then(load)}>
                    Resolve
                  </Button>
                </div>
              </div>
              <div className="mt-4">
                <div className="mb-2 text-xs uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">Admin notes</div>
                <Textarea
                  value={notesById[row.id] ?? ""}
                  onChange={(event) => setNotesById((current) => ({ ...current, [row.id]: event.target.value }))}
                  placeholder="Add triage notes, reproduction steps, or rollout decisions."
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

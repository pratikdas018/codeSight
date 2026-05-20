import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { fetchAdminUsers } from "../../services/adminService";
import { useRealtimeMetrics } from "../../hooks/useRealtimeMetrics";
import type { AdminLayoutOutletContext } from "./AdminLayout";
import type { AdminUserRow } from "../../types/admin";
import { UserDetailsDialog } from "../../components/admin/UserDetailsDialog";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Skeleton } from "../../components/ui/skeleton";

const PAGE_SIZE = 8;

export const UsersPage = () => {
  const { searchQuery } = useOutletContext<AdminLayoutOutletContext>();
  const [rows, setRows] = useState<AdminUserRow[] | null>(null);
  const [sortKey, setSortKey] = useState<"createdAt" | "totalExecutions" | "lastActive">("lastActive");
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);

  const load = useCallback(async () => {
    setRows(await fetchAdminUsers());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeMetrics(() => {
    void load();
  });

  const filtered = useMemo(() => {
    const base = rows ?? [];
    return base
      .filter((row) =>
        searchQuery
          ? `${row.email} ${row.displayName ?? ""} ${row.role} ${row.mostUsedLanguage}`.toLowerCase().includes(searchQuery.toLowerCase())
          : true,
      )
      .sort((left, right) => {
        if (sortKey === "totalExecutions") {
          return right.totalExecutions - left.totalExecutions;
        }
        return new Date(right[sortKey] ?? 0).getTime() - new Date(left[sortKey] ?? 0).getTime();
      });
  }, [rows, searchQuery, sortKey]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (!rows) {
    return <Skeleton className="h-[760px]" />;
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Users directory</CardTitle>
            <p className="text-sm text-[var(--cs-text-muted)]">Searchable, sortable, and role-aware user monitoring.</p>
          </div>
          <Button variant="secondary" onClick={() => setSortKey((current) => (current === "lastActive" ? "totalExecutions" : current === "totalExecutions" ? "createdAt" : "lastActive"))}>
            <ArrowUpDown className="h-4 w-4" />
            Sort: {sortKey}
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Executions</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead>Primary language</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((row) => (
                <TableRow key={row.id} className="cursor-pointer" onClick={() => setSelectedUser(row)}>
                  <TableCell>
                    <div className="font-medium text-[var(--cs-text)]">{row.displayName || "Unnamed user"}</div>
                    <div className="mt-1 text-xs text-[var(--cs-text-subtle)]">{row.email}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={row.isAdmin ? "warning" : "default"}>{row.role}</Badge>
                      <Badge variant={row.online ? "success" : "default"}>{row.online ? "online" : "idle"}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>{row.totalExecutions}</TableCell>
                  <TableCell>{row.lastActive ? new Date(row.lastActive).toLocaleString() : "No activity"}</TableCell>
                  <TableCell>{row.mostUsedLanguage}</TableCell>
                  <TableCell>{new Date(row.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-[var(--cs-text-muted)]">
              Showing {pageRows.length} of {filtered.length} users
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>
                Previous
              </Button>
              <div className="text-sm text-[var(--cs-text-muted)]">
                Page {page} of {pageCount}
              </div>
              <Button variant="secondary" disabled={page === pageCount} onClick={() => setPage((current) => current + 1)}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <UserDetailsDialog user={selectedUser} open={Boolean(selectedUser)} onOpenChange={(open) => !open && setSelectedUser(null)} />
    </>
  );
};

import type { AdminUserRow } from "../../types/admin";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Badge } from "../ui/badge";

export const UserDetailsDialog = ({
  user,
  open,
  onOpenChange,
}: {
  user: AdminUserRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{user?.displayName || user?.email || "User details"}</DialogTitle>
        <DialogDescription>Execution history summary, role, recent activity, and account status.</DialogDescription>
      </DialogHeader>
      {user ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[var(--cs-border)] p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">Account</div>
            <p className="mt-3 text-sm text-[var(--cs-text-muted)]">{user.email}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant={user.online ? "success" : "default"}>{user.online ? "online" : "idle"}</Badge>
              <Badge variant={user.activeToday ? "info" : "default"}>{user.activeToday ? "active today" : "inactive today"}</Badge>
              <Badge variant={user.isAdmin ? "warning" : "default"}>{user.role}</Badge>
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--cs-border)] p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">Usage</div>
            <p className="mt-3 text-sm text-[var(--cs-text-muted)]">Total executions: {user.totalExecutions}</p>
            <p className="mt-2 text-sm text-[var(--cs-text-muted)]">Most used language: {user.mostUsedLanguage}</p>
            <p className="mt-2 text-sm text-[var(--cs-text-muted)]">Last active: {user.lastActive ? new Date(user.lastActive).toLocaleString() : "No activity yet"}</p>
          </div>
          <div className="rounded-2xl border border-[var(--cs-border)] p-4 sm:col-span-2">
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">Timestamps</div>
            <p className="mt-3 text-sm text-[var(--cs-text-muted)]">Created: {new Date(user.createdAt).toLocaleString()}</p>
            <p className="mt-2 text-sm text-[var(--cs-text-muted)]">Last seen: {new Date(user.lastSeenAt).toLocaleString()}</p>
          </div>
        </div>
      ) : null}
    </DialogContent>
  </Dialog>
);

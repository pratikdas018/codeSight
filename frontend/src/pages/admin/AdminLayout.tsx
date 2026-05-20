import {
  Bell,
  LayoutDashboard,
  LineChart,
  MessageSquareQuote,
  PanelLeftClose,
  Shield,
  TerminalSquare,
  Users,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchAdminNotifications } from "../../services/adminService";
import type { AdminNotification } from "../../types/admin";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { ScrollArea } from "../../components/ui/scroll-area";
import { useAuth } from "../../hooks/useAuth";

const navItems = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { href: "/admin/analytics", label: "Analytics", icon: LineChart },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/executions", label: "Executions", icon: TerminalSquare },
  { href: "/admin/errors", label: "Errors", icon: Shield },
  { href: "/admin/feedback", label: "Feedback", icon: MessageSquareQuote },
];

export interface AdminLayoutOutletContext {
  searchQuery: string;
}

const toneVariant = (tone: AdminNotification["tone"]) => {
  switch (tone) {
    case "error":
      return "danger";
    case "warning":
      return "warning";
    case "success":
      return "success";
    default:
      return "info";
  }
};

export const AdminLayout = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  useEffect(() => {
    void fetchAdminNotifications().then(setNotifications).catch(() => setNotifications([]));
  }, [location.pathname]);

  useEffect(() => {
    setShowMobileMenu(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(0,255,65,0.12),transparent_18%),linear-gradient(180deg,#040604_0%,#050505_100%)] text-[var(--cs-text)]">
      <div className="sticky top-0 z-40 border-b border-[rgba(114,255,112,0.08)] bg-[rgba(4,6,4,0.88)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto max-w-[1800px] px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
                CodeSight Admin
              </div>
              <div className="truncate text-lg font-semibold tracking-[-0.04em] text-[var(--cs-text)]">
                Operations dashboard
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowMobileMenu((current) => !current)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--cs-border)] bg-[rgba(8,10,8,0.92)] text-[var(--cs-text-muted)] transition hover:text-[var(--cs-text)]"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.end}
                className={({ isActive }) =>
                  `inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs uppercase tracking-[0.16em] transition ${
                    isActive
                      ? "border-[rgba(114,255,112,0.18)] bg-[rgba(114,255,112,0.1)] text-[var(--cs-primary-bright)]"
                      : "border-[var(--cs-border)] bg-[rgba(8,10,8,0.9)] text-[var(--cs-text-muted)]"
                  }`
                }
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </NavLink>
            ))}
          </div>

          {showMobileMenu ? (
            <div className="mt-3 rounded-[1.5rem] border border-[var(--cs-border)] bg-[rgba(8,10,8,0.94)] p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">
                Session
              </div>
              <p className="mt-3 truncate text-sm text-[var(--cs-text)]">{user?.email}</p>
              <Button variant="secondary" className="mt-4 w-full" onClick={() => void logout()}>
                Log out
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mx-auto flex min-h-screen max-w-[1800px] gap-4 px-3 py-3 sm:gap-6 sm:px-6 sm:py-4 3xl:px-10">
        <aside className="hidden w-[290px] shrink-0 lg:block">
          <Card className="sticky top-4 flex h-[calc(100vh-2rem)] flex-col p-4">
            <div className="px-2 pt-2">
              <div className="text-xs uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
                CodeSight Admin
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-[-0.05em]">Signal center</h1>
              <p className="mt-2 text-sm leading-6 text-[var(--cs-text-muted)]">
                Monitor product usage, failures, and learning engagement in one live desktop console.
              </p>
            </div>

            <nav className="mt-6 flex flex-1 flex-col gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                      isActive
                        ? "border border-[rgba(114,255,112,0.16)] bg-[rgba(114,255,112,0.09)] text-[var(--cs-primary-bright)] shadow-[0_0_28px_rgba(0,255,65,0.08)]"
                        : "text-[var(--cs-text-muted)] hover:bg-white/5 hover:text-[var(--cs-text)]"
                    }`
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="rounded-2xl border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">Session</div>
              <p className="mt-3 truncate text-sm text-[var(--cs-text)]">{user?.email}</p>
              <Button variant="secondary" className="mt-4 w-full" onClick={() => void logout()}>
                Log out
              </Button>
            </div>
          </Card>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-5 flex flex-col gap-4 lg:mb-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="hidden lg:block">
              <div className="text-xs uppercase tracking-[0.22em] text-[var(--cs-text-subtle)]">
                Protected Admin Route
              </div>
              <h2 className="mt-2 text-[clamp(2rem,2vw,2.8rem)] font-semibold tracking-[-0.06em]">
                Operations dashboard
              </h2>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Global search users, errors, feedback, language..."
                className="w-full sm:w-[360px] xl:w-[390px]"
              />
              <div className="inline-flex items-center gap-2 rounded-2xl border border-[var(--cs-border)] bg-[rgba(8,10,8,0.9)] px-4 py-2.5 text-sm text-[var(--cs-text-muted)]">
                <Bell className="h-4 w-4 text-[var(--cs-primary)]" />
                {notifications.length} alerts
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0">
              <Outlet context={{ searchQuery } satisfies AdminLayoutOutletContext} />
            </div>

            <div className="min-w-0">
              <Card className="p-4 sm:p-5 xl:sticky xl:top-4">
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--cs-text)]">
                  <Bell className="h-4 w-4 text-[var(--cs-primary)]" />
                  Admin notifications
                </div>
                <ScrollArea className="mt-4 h-auto max-h-[360px] xl:h-[420px]">
                  <div className="space-y-3 pr-3">
                    {notifications.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[var(--cs-border)] p-4 text-sm text-[var(--cs-text-muted)]">
                        No fresh alerts right now.
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className="rounded-2xl border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-medium text-[var(--cs-text)]">
                              {notification.title}
                            </div>
                            <Badge variant={toneVariant(notification.tone)}>
                              {notification.tone}
                            </Badge>
                          </div>
                          <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--cs-text-muted)]">
                            {notification.message}
                          </p>
                          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">
                            {new Date(notification.createdAt).toLocaleString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

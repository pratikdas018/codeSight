import { useCallback, useEffect, useState } from "react";
import { Activity, ArrowUpRight, Sparkles, UsersRound, Zap } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fetchAdminOverviewMetrics,
  fetchAnalyticsDataset,
  fetchSystemHealthSnapshot,
  fetchVisualizationSessions,
} from "../../services/adminService";
import { useRealtimeMetrics } from "../../hooks/useRealtimeMetrics";
import type { AdminLayoutOutletContext } from "./AdminLayout";
import type {
  AdminOverviewMetrics,
  SystemHealthSnapshot,
  VisualizationSessionRecord,
} from "../../types/admin";
import { MetricCard } from "../../components/admin/MetricCard";
import { ChartCard } from "../../components/admin/ChartCard";
import { SystemHealthPanel } from "../../components/admin/SystemHealthPanel";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";

const initialHealth: SystemHealthSnapshot = {
  backendConnection: "checking",
  executorMode: "local",
  executionProvider: "booting",
  runtimeInstalledCount: 0,
  runtimeMissingCount: 0,
  rendererOnline: navigator.onLine,
};

export const AdminOverviewPage = () => {
  const { searchQuery } = useOutletContext<AdminLayoutOutletContext>();
  const [metrics, setMetrics] = useState<AdminOverviewMetrics | null>(null);
  const [activitySeries, setActivitySeries] = useState<Array<{ label: string; value: number }>>([]);
  const [health, setHealth] = useState<SystemHealthSnapshot>(initialHealth);
  const [sessions, setSessions] = useState<VisualizationSessionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    const [overview, analytics, systemHealth, visualizationSessions] = await Promise.all([
      fetchAdminOverviewMetrics(),
      fetchAnalyticsDataset(),
      fetchSystemHealthSnapshot(),
      fetchVisualizationSessions(),
    ]);

    setMetrics(overview);
    setActivitySeries(
      analytics.dailyActiveUsers
        .slice(-14)
        .map((item) => ({ label: item.label, value: item.value })),
    );
    setHealth(systemHealth);
    setSessions(
      visualizationSessions.filter((session) =>
        searchQuery
          ? `${session.language} ${session.totalSteps} ${session.playbackDuration}`
              .toLowerCase()
              .includes(searchQuery.toLowerCase())
          : true,
      ),
    );
    setIsLoading(false);
  }, [searchQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeMetrics(() => {
    void load();
  });

  if (isLoading || !metrics) {
    return <Skeleton className="h-[920px]" />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <div className="border-b border-[var(--cs-border)] bg-[radial-gradient(circle_at_top_left,rgba(114,255,112,0.16),transparent_30%),linear-gradient(180deg,rgba(11,16,11,0.96),rgba(6,8,6,0.98))] p-5 sm:p-7 lg:border-b-0 lg:border-r">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="success">Realtime admin stream</Badge>
                <Badge variant="info">{metrics.activeUsersOnline} online now</Badge>
              </div>
              <h3 className="mt-4 text-[clamp(1.7rem,5vw,3rem)] font-semibold tracking-[-0.07em] text-[var(--cs-text)]">
                CodeSight is active, stable, and generating learning telemetry.
              </h3>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--cs-text-muted)] sm:text-base">
                Use this command surface to watch adoption, execution quality, playback engagement,
                and error pressure without leaving the product.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[var(--cs-border)] bg-[rgba(255,255,255,0.03)] p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">
                    <UsersRound className="h-4 w-4 text-[var(--cs-primary)]" />
                    User pulse
                  </div>
                  <div className="mt-3 text-2xl font-semibold tracking-[-0.05em]">
                    {metrics.activeUsersToday}
                  </div>
                  <p className="mt-2 text-sm text-[var(--cs-text-muted)]">Active learners today</p>
                </div>
                <div className="rounded-2xl border border-[var(--cs-border)] bg-[rgba(255,255,255,0.03)] p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">
                    <Zap className="h-4 w-4 text-[var(--cs-primary)]" />
                    Runtime
                  </div>
                  <div className="mt-3 text-2xl font-semibold tracking-[-0.05em]">
                    {metrics.successRate}%
                  </div>
                  <p className="mt-2 text-sm text-[var(--cs-text-muted)]">Execution success rate</p>
                </div>
                <div className="rounded-2xl border border-[var(--cs-border)] bg-[rgba(255,255,255,0.03)] p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">
                    <Sparkles className="h-4 w-4 text-[var(--cs-primary)]" />
                    Learning
                  </div>
                  <div className="mt-3 text-2xl font-semibold tracking-[-0.05em]">
                    {metrics.visualizationCount}
                  </div>
                  <p className="mt-2 text-sm text-[var(--cs-text-muted)]">Playback sessions tracked</p>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-7">
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">
                Executive snapshot
              </div>
              <div className="mt-4 grid gap-3">
                {[
                  {
                    label: "Most active language",
                    value: metrics.mostActiveLanguage,
                    tone: "success" as const,
                  },
                  {
                    label: "Retention proxy",
                    value: `${metrics.retentionRate}%`,
                    tone: "info" as const,
                  },
                  {
                    label: "Open feedback + failures",
                    value: `${metrics.feedbackSubmissions + metrics.crashReports}`,
                    tone: "warning" as const,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] px-4 py-3"
                  >
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">
                        {item.label}
                      </div>
                      <div className="mt-2 text-lg font-semibold text-[var(--cs-text)]">{item.value}</div>
                    </div>
                    <Badge variant={item.tone}>live</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <MetricCard
          label="Total users"
          value={metrics.totalUsers.toLocaleString()}
          hint="All profiles synced from Supabase Auth."
          delta={`${metrics.activeUsersToday} active today`}
        />
        <MetricCard
          label="Active today"
          value={metrics.activeUsersToday.toLocaleString()}
          hint={`${metrics.activeUsersOnline} users active in the last five minutes.`}
          delta="Realtime presence proxy"
          accent="info"
        />
        <MetricCard
          label="Total executions"
          value={metrics.totalExecutions.toLocaleString()}
          hint={`${metrics.successRate}% success rate across all tracked runs.`}
          delta={`${metrics.runtimeFailureRate}% failure rate`}
        />
        <MetricCard
          label="Failures"
          value={`${metrics.runtimeFailureRate}%`}
          hint={`${metrics.crashReports} crash reports recorded.`}
          delta={`${metrics.feedbackSubmissions} feedback submissions`}
          accent="danger"
        />
        <MetricCard
          label="Visualizations"
          value={metrics.visualizationCount.toLocaleString()}
          hint="Playback sessions tracked from the visual debugger."
          delta={`${metrics.retentionRate}% retention proxy`}
          accent="warning"
        />
        <MetricCard
          label="Top language"
          value={metrics.mostActiveLanguage}
          hint="Measured from execution activity across the product."
          delta="From aggregate execution logs"
        />
        <MetricCard
          label="Retention"
          value={`${metrics.retentionRate}%`}
          hint="Seven-day retention proxy from recent active cohorts."
          delta="Cohort-style approximation"
          accent="info"
        />
        <MetricCard
          label="Feedback"
          value={metrics.feedbackSubmissions.toLocaleString()}
          hint="Reports collected directly in Supabase with status management."
          delta={`${metrics.crashReports} crash entries`}
          accent="warning"
        />
      </div>

      <div className="grid gap-4 lg:gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <ChartCard
          title="Daily Active Users"
          description="Fourteen-day activity curve with smooth realtime refresh."
        >
          <div className="h-[240px] sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activitySeries}>
                <defs>
                  <linearGradient id="overview-activity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#72ff70" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#72ff70" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="label" stroke="#6f8a71" tick={{ fontSize: 11 }} />
                <YAxis stroke="#6f8a71" tick={{ fontSize: 11 }} width={28} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 18,
                    border: "1px solid rgba(114,255,112,0.18)",
                    background: "rgba(8,10,8,0.96)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#72ff70"
                  fill="url(#overview-activity)"
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Health snapshot"
          description="Live operational state for the desktop runtime environment."
        >
          <SystemHealthPanel health={health} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <ChartCard
          title="Engagement mix"
          description="Fast read on active users, feedback, and crash pressure."
        >
          <div className="h-[250px] sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: "Active today", value: metrics.activeUsersToday },
                    { name: "Feedback", value: metrics.feedbackSubmissions },
                    { name: "Crash reports", value: metrics.crashReports },
                  ]}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={92}
                  paddingAngle={6}
                  fill="#72ff70"
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 18,
                    border: "1px solid rgba(114,255,112,0.18)",
                    background: "rgba(8,10,8,0.96)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <Card>
          <CardHeader>
            <CardTitle>Recent visualization sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--cs-border)] p-4 text-sm text-[var(--cs-text-muted)]">
                No visualization sessions match the current search.
              </div>
            ) : (
              sessions.slice(0, 6).map((session) => (
                <div
                  key={session.id}
                  className="flex flex-col gap-3 rounded-2xl border border-[var(--cs-border)] bg-[rgba(255,255,255,0.02)] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 text-sm text-[var(--cs-text)]">
                      <Activity className="h-4 w-4 text-[var(--cs-primary)]" />
                      {session.language}
                    </div>
                    <p className="mt-2 text-sm text-[var(--cs-text-muted)]">
                      {session.totalSteps} steps · {Math.round(session.playbackDuration / 1000)}s playback
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <Badge variant="success">tracked</Badge>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--cs-text-subtle)]">
                      {new Date(session.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
            <Button variant="secondary" className="w-full">
              <ArrowUpRight className="h-4 w-4" />
              Realtime feed active
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

import { useCallback, useEffect, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchAnalyticsDataset } from "../../services/adminService";
import { useRealtimeMetrics } from "../../hooks/useRealtimeMetrics";
import { ChartCard } from "../../components/admin/ChartCard";
import { Skeleton } from "../../components/ui/skeleton";

export const AnalyticsPage = () => {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchAnalyticsDataset>> | null>(null);

  const load = useCallback(async () => {
    setData(await fetchAnalyticsDataset());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeMetrics(() => {
    void load();
  });

  if (!data) {
    return <Skeleton className="h-[840px]" />;
  }

  return (
    <div className="grid gap-6 2xl:grid-cols-2">
      <ChartCard title="Daily active users" description="Unique active users by day from user activity events.">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.dailyActiveUsers}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" stroke="#6f8a71" />
              <YAxis stroke="#6f8a71" />
              <Tooltip contentStyle={{ borderRadius: 18, border: "1px solid rgba(114,255,112,0.18)", background: "rgba(8,10,8,0.96)" }} />
              <Line type="monotone" dataKey="value" stroke="#72ff70" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard title="Execution trends" description="All execution attempts, refreshed automatically from Supabase Realtime.">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.executionTrends}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" stroke="#6f8a71" />
              <YAxis stroke="#6f8a71" />
              <Tooltip contentStyle={{ borderRadius: 18, border: "1px solid rgba(114,255,112,0.18)", background: "rgba(8,10,8,0.96)" }} />
              <Bar dataKey="value" fill="#72ff70" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard title="Execution success vs failure" description="Successes and failed runs split by day.">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.executionSuccessVsFailure}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" stroke="#6f8a71" />
              <YAxis stroke="#6f8a71" />
              <Tooltip contentStyle={{ borderRadius: 18, border: "1px solid rgba(114,255,112,0.18)", background: "rgba(8,10,8,0.96)" }} />
              <Legend />
              <Line type="monotone" dataKey="value" name="Success" stroke="#72ff70" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="secondaryValue" name="Failure" stroke="#fb7185" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard title="User growth" description="Cumulative profile growth over time.">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.userGrowth}>
              <defs>
                <linearGradient id="user-growth-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#72ff70" stopOpacity={0.42} />
                  <stop offset="100%" stopColor="#72ff70" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" stroke="#6f8a71" />
              <YAxis stroke="#6f8a71" />
              <Tooltip contentStyle={{ borderRadius: 18, border: "1px solid rgba(114,255,112,0.18)", background: "rgba(8,10,8,0.96)" }} />
              <Area type="monotone" dataKey="value" stroke="#72ff70" fill="url(#user-growth-fill)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard title="Language popularity" description="Usage distribution and failure pressure by language.">
        <div className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.languagePopularity}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="language" stroke="#6f8a71" />
              <YAxis stroke="#6f8a71" />
              <Tooltip contentStyle={{ borderRadius: 18, border: "1px solid rgba(114,255,112,0.18)", background: "rgba(8,10,8,0.96)" }} />
              <Legend />
              <Bar dataKey="total" fill="#72ff70" radius={[10, 10, 0, 0]} />
              <Bar dataKey="failed" fill="#fb7185" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
};

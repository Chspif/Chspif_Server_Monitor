"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useServerHistories } from "@/lib/hooks";
import { formatAxisTime, formatPercent, formatRate } from "@/lib/format";
import type { HistoryRange, ServerHistory, ServerMetricPoint } from "@/lib/types";

type MetricKey = Extract<
  keyof ServerMetricPoint,
  "cpuPercent" | "memPercent" | "netInBps" | "netOutBps"
>;

const RANGE_TABS: { value: HistoryRange; label: string }[] = [
  { value: "1h", label: "1小时" },
  { value: "24h", label: "24小时" },
  { value: "7d", label: "7天" },
];

/** 各时间范围对应的采样桶(毫秒),用于把多台服务器的时间戳对齐合并 */
const RANGE_BUCKET_MS: Record<HistoryRange, number> = {
  "1h": 60_000,
  "24h": 900_000,
  "7d": 3_600_000,
};

interface TooltipEntry {
  dataKey?: unknown;
  name?: unknown;
  value?: unknown;
  color?: unknown;
}

/** 可对比多台服务器的指标趋势图(CPU / 内存) */
export function MetricTrendChart({
  title,
  description,
  metric,
  servers,
}: {
  title: string;
  description: string;
  metric: MetricKey;
  servers: { id: string; name: string; color: string }[];
}) {
  const [range, setRange] = useState<HistoryRange>("1h");
  const queries = useServerHistories(
    servers.map((s) => s.id),
    range
  );
  const histories = queries.map((q) => q.data?.data);
  const isLoading = queries.some((q) => q.isLoading);

  const yTick = (v: number) =>
    metric === "cpuPercent" || metric === "memPercent" ? formatPercent(v, 0) : formatRate(v);

  /** 按采样桶对齐时间戳,合并所有服务器,保证曲线连续 */
  const rows = useMemo(() => {
    const available = histories.filter((h): h is ServerHistory => Boolean(h));
    if (available.length === 0) return [];
    const bucketMs = RANGE_BUCKET_MS[range];
    const byTs = new Map<number, Record<string, string | number>>();
    for (const h of available) {
      const name = servers.find((s) => s.id === h.serverId)?.name ?? h.serverId;
      for (const p of h.points) {
        const ts = Math.floor(new Date(p.timestamp).getTime() / bucketMs) * bucketMs;
        const row = byTs.get(ts) ?? { timestamp: new Date(ts).toISOString() };
        row[name] = Number(p[metric]);
        byTs.set(ts, row);
      }
    }
    return Array.from(byTs.values()).sort((a, b) =>
      String(a.timestamp).localeCompare(String(b.timestamp))
    );
  }, [histories, servers, metric, range]);

  function ChartTooltip({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: TooltipEntry[];
    label?: unknown;
  }) {
    if (!active || !payload || payload.length === 0) return null;
    const sorted = [...payload].sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0));
    return (
      <div className="rounded-lg border border-white/10 bg-[#0f172a] px-3 py-2 shadow-lg">
        <p className="mb-1.5 font-mono text-[11px] text-slate-400">
          {formatAxisTime(String(label ?? ""))}
        </p>
        <div className="space-y-1">
          {sorted.map((e, i) => (
            <div key={String(e.dataKey ?? i)} className="flex items-center justify-between gap-6 text-xs">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="size-2 rounded-full" style={{ background: typeof e.color === "string" ? e.color : undefined }} />
                {String(e.name ?? "")}
              </span>
              <span className="font-mono tabular-nums text-slate-100">{yTick(Number(e.value ?? 0))}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <Tabs value={range} onValueChange={(v) => setRange(v as HistoryRange)}>
            <TabsList className="h-8">
              {RANGE_TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className="px-2.5 text-xs">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading || rows.length === 0 ? (
          <Skeleton className="h-[260px] w-full" />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatAxisTime}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={48}
                  tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                />
                <YAxis
                  tickFormatter={yTick}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  domain={[0, "auto"]}
                  tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                />
                <Tooltip
                  content={(props) => <ChartTooltip {...props} />}
                  cursor={{ stroke: "var(--color-muted-foreground)", strokeDasharray: "4 4" }}
                />
                {servers.map((s) => (
                  <Area
                    key={s.id}
                    type="monotone"
                    dataKey={s.name}
                    name={s.name}
                    stroke={s.color}
                    strokeWidth={1.5}
                    fill={s.color}
                    fillOpacity={0.12}
                    animationDuration={800}
                    animationEasing="ease-out"
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              {servers.map((s) => (
                <span key={s.id} className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <span className="size-2 rounded-full" style={{ background: s.color }} />
                  {s.name}
                </span>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

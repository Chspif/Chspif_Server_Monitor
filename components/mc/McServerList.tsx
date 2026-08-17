"use client";

import type { ReactNode } from "react";
import { Gamepad2, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { McServerCard } from "@/components/mc/McServerCard";
import { useMcServers } from "@/lib/hooks";
import type { McServerGroup } from "@/lib/types";

function SummaryCard({
  title,
  icon,
  value,
  sub,
}: {
  title: string;
  icon: ReactNode;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground/70">{icon}</span>
          {title}
        </span>
        <div className="font-mono text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
        {sub && <div className="text-muted-foreground font-mono text-xs">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export function McServerList() {
  const { data, isLoading } = useMcServers();
  const groups: McServerGroup[] = data?.data ?? [];

  const onlineNodes = groups.reduce((s, g) => s + g.onlineNodes, 0);
  const totalNodes = groups.reduce((s, g) => s + g.totalNodes, 0);
  const totalPlayers = groups.reduce((s, g) => s + g.totalPlayers, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">服务器节点</h1>
        <h3 className="text-lg font-semibold tracking-tight">各节点显示延迟不代表客户端连接延迟，请选择地理位置就近的节点</h3> 
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          title="在线节点"
          icon={<Gamepad2 className="size-4" />}
          value={isLoading && !groups.length ? "--" : `${onlineNodes}/${totalNodes}`}
          sub="全部 MC 服务器"
        />
      </div>

      {isLoading && !groups.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex flex-col gap-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((g) => (
            <McServerCard key={g.id} group={g} />
          ))}
        </div>
      )}
    </div>
  );
}

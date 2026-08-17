"use client";

import { Cpu, HardDrive, MemoryStick, Server } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SERVER_STATUS_META } from "@/lib/constants";
import { formatBytes } from "@/lib/format";
import type { ServerInfo } from "@/lib/types";
import { cn } from "@/lib/utils";


export function HardwareConfigCard({
  servers,
  isLoading,
}: {
  servers: ServerInfo[] | undefined;
  isLoading: boolean;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">硬件配置</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && !servers ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {(servers ?? []).map((s) => {
              const meta = SERVER_STATUS_META[s.status];
              return (
                <div key={s.id} className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex size-7 items-center justify-center rounded-md font-mono text-xs font-semibold text-white"
                      style={{ background: s.color }}
                    >
                      {s.short}
                    </span>
                    <span className="text-sm font-semibold">{s.name}</span>
                    <span
                      className={cn(
                        "ml-auto inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium",
                        meta.badge
                      )}
                    >
                      <span className={cn("size-1.5 rounded-full", meta.dot)} />
                      {meta.label}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="text-muted-foreground flex items-center gap-2">
                      <Cpu className="size-3.5 shrink-0" />
                      <span className="shrink-0">CPU</span>
                      <span className="ml-auto truncate font-mono text-foreground">
                        {s.cpuModel} · {s.cpuCores} 核
                      </span>
                    </div>
                    <div className="text-muted-foreground flex items-center gap-2">
                      <MemoryStick className="size-3.5 shrink-0" />
                      <span className="shrink-0">内存</span>
                      <span className="ml-auto font-mono tabular-nums text-foreground">
                        {formatBytes(s.totalMemBytes)}
                      </span>
                    </div>
                    <div className="text-muted-foreground flex items-center gap-2">
                      <HardDrive className="size-3.5 shrink-0" />
                      <span className="shrink-0">磁盘</span>
                      <span className="ml-auto font-mono tabular-nums text-foreground">
                        {formatBytes(s.totalDiskBytes)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

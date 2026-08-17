"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Server } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { MC_STATUS_META } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import type { McNode, McServerGroup } from "@/lib/types";
import { cn } from "@/lib/utils";

function McNodeRow({ node }: { node: McNode }) {
  const meta = MC_STATUS_META[node.online ? "online" : "offline"];
  return (
    <div className="rounded-md border px-2.5 py-2" title={`检测地址: ${node.host}:${node.port}`}>
      <div className="flex items-center gap-2 text-xs">
        <span className={cn("size-2 shrink-0 rounded-full", meta.dot)} />
        {node.location && (
          <span className="bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium">
            {node.location}
          </span>
        )}
        <span className="font-mono font-semibold">{node.display}</span>
        <span className="text-muted-foreground ml-auto w-16 text-right font-mono tabular-nums">
          {node.online ? `${node.latencyMs} ms` : "离线"}
        </span>
      </div>
    </div>
  );
}

/** MC 服务器卡:一个服务器,含多个网络节点 */
export function McServerCard({ group }: { group: McServerGroup }) {
  const reducedMotion = useReducedMotion();
  const badge =
    group.onlineNodes === 0
      ? MC_STATUS_META.offline
      : group.onlineNodes === group.totalNodes
        ? MC_STATUS_META.online
        : MC_STATUS_META.starting; // 部分节点在线,用中间色

  return (
    <motion.div whileHover={reducedMotion ? undefined : { y: -2 }} transition={{ duration: 0.15 }}>
      <Card className="h-full transition-shadow duration-150 hover:shadow-md">
        <CardContent className="flex h-full flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <Server className="size-4 text-muted-foreground" />
            <p className="text-sm font-semibold">{group.name}</p>
            <span
              className={cn(
                "ml-auto inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
                badge.badge
              )}
            >
              <span className={cn("size-1.5 rounded-full", badge.dot)} />
              在线 {group.onlineNodes}/{group.totalNodes} 节点
            </span>
          </div>

          <div className="space-y-2">
            {group.nodes.map((n) => (
              <McNodeRow key={n.id} node={n} />
            ))}
          </div>

          <p className="text-muted-foreground mt-auto font-mono text-[11px]">
             更新{" "}
            {formatDateTime(group.nodes[0]?.lastPingAt ?? "")}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

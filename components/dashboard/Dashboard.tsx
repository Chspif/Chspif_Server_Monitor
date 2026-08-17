"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HardwareConfigCard } from "@/components/dashboard/HardwareConfigCard";
import { MetricTrendChart } from "@/components/dashboard/MetricTrendChart";
import { NetworkChart } from "@/components/dashboard/NetworkChart";
import { SERVER_META } from "@/lib/constants";
import { useServers } from "@/lib/hooks";

export function Dashboard() {
  const reducedMotion = useReducedMotion();

  const serversQuery = useServers();

  const serverDefs = SERVER_META.map((m) => ({ id: m.id, name: m.name, color: m.color }));
  const servers = serversQuery.data?.data;

  const isLoading = serversQuery.isLoading;
  const firstError = serversQuery.error;

  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reducedMotion ? 0 : 0.07 } },
  };
  const item: Variants = {
    hidden: { opacity: 0, y: reducedMotion ? 0 : 16 },
    show: { opacity: 1, y: 0, transition: { duration: reducedMotion ? 0 : 0.45, ease: "easeOut" } },
  };

  if (firstError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <AlertCircle className="text-destructive size-8" />
          <p className="text-sm font-medium">数据加载失败</p>
          <p className="text-muted-foreground font-mono text-xs">
            {firstError instanceof Error ? firstError.message : "未知错误"}
          </p>
          <Button variant="outline" size="sm" onClick={() => void serversQuery.refetch()}>
            重试
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item}>
        <HardwareConfigCard servers={servers} isLoading={isLoading} />
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={item}>
          <MetricTrendChart
            title="CPU 使用率"
            description=""
            metric="cpuPercent"
            servers={serverDefs}
          />
        </motion.div>
        <motion.div variants={item}>
          <MetricTrendChart
            title="内存使用"
            description=""
            metric="memPercent"
            servers={serverDefs}
          />
        </motion.div>
      </div>

      <motion.div variants={item}>
        <NetworkChart servers={serverDefs} />
      </motion.div>
    </motion.div>
  );
}

/**
 * 前端数据层
 * 所有请求都走同源 Next.js API routes,由服务端 lib/prometheus.ts 查询 Prometheus。
 * 接入真实数据源后组件层无需改动;开发环境连不上 Prometheus 时 API routes 自动回退 mock。
 */

import type {
  ApiResponse,
  HistoryRange,
  McServerGroup,
  PhysicalDisk,
  ServerHistory,
  ServerInfo,
  ServerSummary,
} from "@/lib/types";

async function get<T>(path: string): Promise<ApiResponse<T>> {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function fetchServers(): Promise<ApiResponse<ServerInfo[]>> {
  return get("/api/servers");
}

export function fetchServerSummary(serverId: string): Promise<ApiResponse<ServerSummary>> {
  return get(`/api/servers/${serverId}/summary`);
}

export function fetchServerHistory(
  serverId: string,
  range: HistoryRange = "1h"
): Promise<ApiResponse<ServerHistory>> {
  return get(`/api/servers/${serverId}/history?range=${range}`);
}

export function fetchMcServers(): Promise<ApiResponse<McServerGroup[]>> {
  return get("/api/mc");
}

export function fetchServerDisks(serverId: string): Promise<ApiResponse<PhysicalDisk[]>> {
  return get(`/api/servers/${serverId}/disks`);
}

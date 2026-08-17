/**
 * Prometheus 查询层(仅在服务端 API routes 中使用)
 * -------------------------------------------------
 * 把 windows_exporter 的指标组装成前端 lib/types.ts 定义的结构。
 * 连接 Prometheus 失败(或未配置)时,自动回退到 lib/mock.ts 的 mock 数据,
 * 便于本地开发与演示。
 *
 * 标签策略:
 * - 聚合统一用 by(server, instance):server 标签(server1/server2 等)优先,
 *   instance 始终存在兜底。
 * - 时间范围:1h / 24h / 7d,采样间隔与 rate 窗口随范围调整。
 */

import { SERVER_META } from "@/lib/constants";
import {
  getServerHistory as mockHistory,
  getServerSummary as mockSummary,
  getServers as mockServers,
  mockPhysicalDisks,
} from "@/lib/mock";
import type {
  HistoryRange,
  PhysicalDisk,
  ServerDisk,
  ServerHistory,
  ServerInfo,
  ServerMetricPoint,
  ServerStatus,
  ServerSummary,
} from "@/lib/types";

const PROM_URL = (process.env.PROMETHEUS_URL || "http://localhost:9090").replace(/\/+$/, "");
const HTTP_TIMEOUT_MS = 6_000;
const HISTORY_CACHE_TTL_MS = 25_000;
const SUMMARY_CACHE_TTL_MS = 4_000;

interface PromResult {
  metric: Record<string, string>;
  value: [number, string];
}

interface PromRangeResult {
  metric: Record<string, string>;
  values: [number, string][];
}

/** 各时间范围的查询窗口(秒)、采样步长(秒)、rate 窗口 */
function rangeConfig(range: HistoryRange): { seconds: number; step: number; rate: string } {
  switch (range) {
    case "24h":
      return { seconds: 86_400, step: 900, rate: "5m" };
    case "7d":
      return { seconds: 604_800, step: 3_600, rate: "5m" };
    case "1h":
    default:
      return { seconds: 3_600, step: 60, rate: "1m" };
  }
}

/* ------------------------------ 基础 HTTP ------------------------------ */

async function promGet<T>(path: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(`${PROM_URL}${path}`, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`Prometheus HTTP ${res.status}`);
    const json = (await res.json()) as { status: string; data: T; error?: string };
    if (json.status !== "success") throw new Error(json.error ?? "Prometheus query error");
    return json.data;
  } finally {
    clearTimeout(timer);
  }
}

async function promInstant(q: string): Promise<PromResult[]> {
  const data = await promGet<{ result: PromResult[] }>(
    `/api/v1/query?query=${encodeURIComponent(q)}`
  );
  return data.result;
}

async function promRange(
  q: string,
  start: number,
  end: number,
  step: number
): Promise<PromRangeResult[]> {
  const data = await promGet<{ result: PromRangeResult[] }>(
    `/api/v1/query_range?query=${encodeURIComponent(q)}&start=${start}&end=${end}&step=${step}`
  );
  return data.result;
}

/* --------------------------- 标签匹配与提取 --------------------------- */

/** server 标签 → 前端 serverId(兼容多种命名) */
function serverLabelToId(label: string): string {
  const map: Record<string, string> = {
    main: "srv-main",
    build: "srv-build",
    server1: "srv-main",
    server2: "srv-build",
    "srv-main": "srv-main",
    "srv-build": "srv-build",
  };
  return map[label] ?? label;
}

function matchesServer(metric: Record<string, string>, serverId: string): boolean {
  const serverLabel = metric.server;
  if (serverLabel) return serverLabelToId(serverLabel) === serverId;
  const instance = metric.instance;
  if (instance) {
    const meta = SERVER_META.find((m) => m.id === serverId);
    return meta ? instance.startsWith(meta.ip) : false;
  }
  return false;
}

function findResult(results: PromResult[], serverId: string): PromResult | undefined {
  return results.find((r) => matchesServer(r.metric, serverId));
}

function findRangeResult(
  results: PromRangeResult[],
  serverId: string
): PromRangeResult | undefined {
  return results.find((r) => matchesServer(r.metric, serverId));
}

/** 取单个数值(找不到或非法时为 fallback) */
function num(v: string | undefined, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** 把 range 结果的 values 建成 时间戳→值 的映射(便于按时间戳对齐) */
function rangeValueMap(
  results: PromRangeResult[],
  serverId: string
): Map<number, number> | null {
  const r = findRangeResult(results, serverId);
  if (!r) return null;
  const map = new Map<number, number>();
  for (const [ts, v] of r.values) {
    const n = Number(v);
    if (Number.isFinite(n)) map.set(ts, n);
  }
  return map;
}

/* ------------------------------- PromQL ------------------------------- */

const cpuPercentQuery = (rate: string) =>
  `clamp_min(clamp_max(100 - (avg by (server, instance) (rate(windows_cpu_time_total{mode="idle"}[${rate}])) * 100), 100), 0)`;
const MEM_PERCENT = `100 - 100 * windows_memory_physical_free_bytes / windows_memory_physical_total_bytes`;
const DISK_PERCENT = `100 * (1 - sum(windows_logical_disk_free_bytes) by (server, instance) / sum(windows_logical_disk_size_bytes) by (server, instance))`;
const netInQuery = (rate: string) =>
  `sum(rate(windows_net_bytes_received_total[${rate}])) by (server, instance)`;
const netOutQuery = (rate: string) =>
  `sum(rate(windows_net_bytes_sent_total[${rate}])) by (server, instance)`;
const PROCESS_COUNT = `sum(windows_system_processes) by (server, instance)`;
const NET_TOTAL_IN = `sum(windows_net_bytes_received_total) by (server, instance)`;
const NET_TOTAL_OUT = `sum(windows_net_bytes_sent_total) by (server, instance)`;
const CORES = `count by (server, instance) (count by (server, instance, core) (windows_cpu_time_total{core!="total"}))`;

/* ------------------------------ TTL 缓存 ------------------------------ */

const cache = new Map<string, { ts: number; data: unknown }>();

function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < ttlMs) return Promise.resolve(hit.data as T);
  return fn().then((data) => {
    cache.set(key, { ts: Date.now(), data });
    return data;
  });
}

/* ---------------------------- 组装:服务器列表 ---------------------------- */

async function promServers(): Promise<ServerInfo[]> {
  const [hostnames, osInfo, totalMem, totalDisk, cores, uptime, cpuInfo] = await Promise.all([
    promInstant(`windows_os_hostname`),
    promInstant(`windows_os_info`),
    promInstant(`windows_memory_physical_total_bytes`),

    promInstant(`sum by (server, instance) (windows_diskdrive_size)`),
    promInstant(CORES),
    promInstant(`time() - windows_system_boot_time_timestamp`),
    promInstant(`windows_cpu_info`),
  ]);

  return SERVER_META.map((meta): ServerInfo => {
    const host = findResult(hostnames, meta.id);
    const os = findResult(osInfo, meta.id);
    const mem = findResult(totalMem, meta.id);
    const disk = findResult(totalDisk, meta.id);
    const core = findResult(cores, meta.id);
    const up = findResult(uptime, meta.id);
    const cpu = findResult(cpuInfo, meta.id);

    const status: ServerStatus = up ? "online" : "offline";

    return {
      id: meta.id,
      name: meta.name,
      short: meta.short,
      color: meta.color,
      hostname: host?.metric.hostname ?? meta.hostname,
      ip: meta.ip,
      os: os?.metric.product ?? meta.os,
      cpuModel: cpu?.metric.name ?? meta.cpuModel,
      cpuCores: core ? Math.max(1, Math.round(num(core.value[1], meta.cpuCores))) : meta.cpuCores,
      totalMemBytes: mem ? Math.round(num(mem.value[1], meta.totalMemBytes)) : meta.totalMemBytes,
      totalDiskBytes: disk
        ? Math.round(num(disk.value[1], meta.totalDiskBytes))
        : meta.totalDiskBytes,
      uptimeSeconds: up ? Math.round(num(up.value[1], 0)) : 0,
      status,
    };
  });
}

/* ---------------------- 组装:指标摘要(instant) ---------------------- */

async function promSummary(serverId: string): Promise<ServerSummary> {
  const [cpu, mem, disk, netIn, netOut, processes, netTotalIn, netTotalOut, diskSize, diskFree] =
    await Promise.all([
      promInstant(cpuPercentQuery("1m")),
      promInstant(MEM_PERCENT),
      promInstant(DISK_PERCENT),
      promInstant(netInQuery("1m")),
      promInstant(netOutQuery("1m")),
      promInstant(PROCESS_COUNT),
      promInstant(NET_TOTAL_IN),
      promInstant(NET_TOTAL_OUT),
      promInstant(`windows_logical_disk_size_bytes`),
      promInstant(`windows_logical_disk_free_bytes`),
    ]);

  const disks: ServerDisk[] = diskSize
    .filter((r) => matchesServer(r.metric, serverId))
    .map((r) => {
      const free = diskFree.find(
        (f) => matchesServer(f.metric, serverId) && f.metric.volume === r.metric.volume
      );
      const total = num(r.value[1]);
      const freeBytes = free ? num(free.value[1]) : 0;
      return {
        mount: r.metric.volume ?? "--",
        label: r.metric.volume ?? "--",
        filesystem: "NTFS",
        totalBytes: total,
        usedBytes: Math.max(0, total - freeBytes),
      };
    })
    // 过滤空卷(如无碟光驱),避免详情页除零
    .filter((d) => d.totalBytes > 0);

  return {
    serverId,
    cpuPercent: num(findResult(cpu, serverId)?.value[1]),
    memPercent: num(findResult(mem, serverId)?.value[1]),
    diskPercent: num(findResult(disk, serverId)?.value[1]),
    netInBps: num(findResult(netIn, serverId)?.value[1]),
    netOutBps: num(findResult(netOut, serverId)?.value[1]),
    netTotalInBytes: Math.round(num(findResult(netTotalIn, serverId)?.value[1])),
    netTotalOutBytes: Math.round(num(findResult(netTotalOut, serverId)?.value[1])),
    processCount: Math.round(num(findResult(processes, serverId)?.value[1])),
    temperature: null,
    disks,
  };
}

/* ---------------------- 组装:时间序列(query_range) ---------------------- */

async function promHistory(serverId: string, range: HistoryRange): Promise<ServerHistory> {
  const { seconds, step, rate } = rangeConfig(range);
  // 对齐到步长边界,保证同一范围下不同请求的时间轴一致
  const end = Math.floor(Date.now() / 1000 / step) * step;
  const start = end - seconds;

  const [cpu, mem, disk, netIn, netOut, processes] = await Promise.all([
    promRange(cpuPercentQuery(rate), start, end, step),
    promRange(MEM_PERCENT, start, end, step),
    promRange(DISK_PERCENT, start, end, step),
    promRange(netInQuery(rate), start, end, step),
    promRange(netOutQuery(rate), start, end, step),
    promRange(PROCESS_COUNT, start, end, step),
  ]);

  const cpuMap = rangeValueMap(cpu, serverId);
  const memMap = rangeValueMap(mem, serverId);
  const diskMap = rangeValueMap(disk, serverId);
  const netInMap = rangeValueMap(netIn, serverId);
  const netOutMap = rangeValueMap(netOut, serverId);
  const procMap = rangeValueMap(processes, serverId);

  // 以 CPU 的时间轴为基准(缺失时退用任一指标)
  const base = findRangeResult(cpu, serverId)?.values ?? findRangeResult(netIn, serverId)?.values ?? [];

  const points: ServerMetricPoint[] = base.map(([ts]) => ({
    timestamp: new Date(ts * 1000).toISOString(),
    cpuPercent: cpuMap?.get(ts) ?? 0,
    memPercent: memMap?.get(ts) ?? 0,
    diskPercent: diskMap?.get(ts) ?? 0,
    netInBps: netInMap?.get(ts) ?? 0,
    netOutBps: netOutMap?.get(ts) ?? 0,
    processCount: Math.round(procMap?.get(ts) ?? 0),
    temperature: null,
  }));

  return { serverId, points };
}

/* ------------------------------- 对外接口 ------------------------------- */

async function withMockFallback<T>(fn: () => Promise<T>, mock: () => T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn("[prometheus] query failed, fallback to mock:", err);
    return mock();
  }
}

export function getServers(): Promise<ServerInfo[]> {
  return withMockFallback(promServers, mockServers);
}

export function getServerSummary(serverId: string): Promise<ServerSummary> {
  return withMockFallback(
    () => cached(`summary:${serverId}`, SUMMARY_CACHE_TTL_MS, () => promSummary(serverId)),
    () => mockSummary(serverId)
  );
}

export function getServerHistory(
  serverId: string,
  range: HistoryRange = "1h"
): Promise<ServerHistory> {
  return withMockFallback(
    () =>
      cached(`history:${serverId}:${range}`, HISTORY_CACHE_TTL_MS, () =>
        promHistory(serverId, range)
      ),
    // mock 仅提供最近 1 小时数据,长范围时前端会显示该窗口内的点
    () => mockHistory(serverId)
  );
}

/* ---------------------- 组装:物理硬盘(instant) ---------------------- */

async function promPhysicalDisks(serverId: string): Promise<PhysicalDisk[]> {
  const [sizes, infos, statuses, readRate, writeRate, readSec, writeSec] = await Promise.all([
    promInstant(`windows_diskdrive_size`),
    promInstant(`windows_diskdrive_info`),
    promInstant(`windows_diskdrive_status`),
    promInstant(`rate(windows_physical_disk_read_bytes_total[5m])`),
    promInstant(`rate(windows_physical_disk_write_bytes_total[5m])`),
    promInstant(`rate(windows_physical_disk_read_seconds_total[5m])`),
    promInstant(`rate(windows_physical_disk_write_seconds_total[5m])`),
  ]);

  const disks: PhysicalDisk[] = [];
  for (const r of sizes.filter((x) => matchesServer(x.metric, serverId))) {
    const name = r.metric.name ?? "0";
    const info = infos.find((x) => matchesServer(x.metric, serverId) && x.metric.name === name);
    const status = statuses.find(
      (x) => matchesServer(x.metric, serverId) && x.metric.name === name
    );
    const diskMatch = (x: PromResult) =>
      matchesServer(x.metric, serverId) &&
      (x.metric.disk === name || x.metric.disk === `PhysicalDrive${name}`);
    const read = readRate.find(diskMatch);
    const write = writeRate.find(diskMatch);
    const rs = readSec.find(diskMatch);
    const ws = writeSec.find(diskMatch);

    disks.push({
      name,
      model: info?.metric.model ?? "",
      sizeBytes: Math.round(num(r.value[1])),
      status: status?.metric.status ?? "Unknown",
      readBps: read ? num(read.value[1]) : 0,
      writeBps: write ? num(write.value[1]) : 0,
      activityPercent: Math.min(
        100,
        Math.max(0, (rs ? num(rs.value[1]) : 0) * 100 + (ws ? num(ws.value[1]) : 0) * 100)
      ),
    });
  }
  return disks.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

export function getServerDisks(serverId: string): Promise<PhysicalDisk[]> {
  return withMockFallback(
    () => cached(`disks:${serverId}`, SUMMARY_CACHE_TTL_MS, () => promPhysicalDisks(serverId)),
    () => mockPhysicalDisks(serverId)
  );
}

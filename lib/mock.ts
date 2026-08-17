/**
 * Mock 数据层(服务端回退与本地演示)
 * -----------------------------------
 * 当 lib/prometheus.ts 连不上 Prometheus 时,作为回退数据源;也便于本地 npm run dev 预览。
 * 模块内维护共享内存状态:
 * - 每次 fetch 都会调用 ensureTick() 按需推进数据
 * - 数据带随机游走 + 突发,贴近真实服务器曲线
 *
 * 接入真实后端时,此文件可整体废弃,仅需替换 lib/api.ts 的实现。
 */

import { MC_SERVER_META, SERVER_META } from "@/lib/constants";
import type {
  McStatus,
  MinecraftServer,
  PhysicalDisk,
  ServerDisk,
  ServerHistory,
  ServerInfo,
  ServerMetricPoint,
  ServerStatus,
  ServerSummary,
} from "@/lib/types";

/** 时间序列长度(最近 60 个点,每点 1 分钟) */
const POINTS = 60;
/** 每个点间隔(毫秒) */
const STEP_MS = 60_000;
/** 两次推进之间的最小间隔(避免同帧多次 fetch 重复推进) */
const TICK_MIN_INTERVAL = 3_000;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** 随机游走一步:向 baseline 回拉 + 随机偏移 */
function walk(prev: number, min: number, max: number, step: number, baseline: number, pull: number): number {
  const drift = (baseline - prev) * pull;
  const delta = (Math.random() - 0.5) * 2 * step + drift;
  return clamp(prev + delta, min, max);
}

/** 网络速率:平滑逼近目标值(含突发) */
function netWalk(prev: number, target: number): number {
  return clamp(prev + (target - prev) * 0.35, 0, 400e6);
}

/* ------------------------------- 初始化 ------------------------------- */

function seedPoint(i: number, index: number): ServerMetricPoint {
  const t = Date.now() - (POINTS - 1 - i) * STEP_MS;
  const memBase = index === 0 ? 52 : 61;
  const memVar = ((Math.sin(i / 7 + index) + 1) / 2) * 18;
  const cpuBase = index === 0 ? 34 : 42;
  return {
    timestamp: new Date(t).toISOString(),
    cpuPercent: clamp(cpuBase + ((Math.sin(i / 3 + index) + 1) / 2) * 30 + (Math.random() - 0.5) * 12, 3, 97),
    memPercent: clamp(memBase + memVar + (Math.random() - 0.5) * 3, 20, 92),
    diskPercent: index === 0 ? 63.2 : 41.8,
    netInBps: 0.8e6 + Math.random() * 2e6,
    netOutBps: 0.4e6 + Math.random() * 1.5e6,
    processCount: Math.round(160 + Math.random() * 120),
    temperature: null, // Windows 传感器支持有限,无数据
  };
}

function makeDisks(index: number): ServerDisk[] {
  if (index === 0) {
    return [
      { mount: "C:", label: "系统盘", totalBytes: 512 * 1024 ** 3, usedBytes: Math.round(312 * 1024 ** 3), filesystem: "NTFS" },
      { mount: "D:", label: "游戏盘", totalBytes: 1024 ** 4, usedBytes: Math.round(664 * 1024 ** 3), filesystem: "NTFS" },
    ];
  }
  return [
    { mount: "C:", label: "系统盘", totalBytes: 512 * 1024 ** 3, usedBytes: Math.round(208 * 1024 ** 3), filesystem: "NTFS" },
    { mount: "D:", label: "构建缓存", totalBytes: 2 * 1024 ** 4, usedBytes: Math.round(836 * 1024 ** 3), filesystem: "ReFS" },
    { mount: "E:", label: "备份盘", totalBytes: 2 * 1024 ** 4, usedBytes: Math.round(121 * 1024 ** 3), filesystem: "NTFS" },
  ];
}

function buildServers(): ServerInfo[] {
  return SERVER_META.map((m, i) => ({
    id: m.id,
    name: m.name,
    short: m.short,
    color: m.color,
    hostname: m.hostname,
    ip: m.ip,
    os: m.os,
    cpuModel: m.cpuModel,
    cpuCores: m.cpuCores,
    totalMemBytes: m.totalMemBytes,
    totalDiskBytes: m.totalDiskBytes,
    uptimeSeconds: (i === 0 ? 6 : 2) * 86400 + Math.floor(Math.random() * 43200),
    status: "online" as ServerStatus,
  }));
}

function buildMc(): MinecraftServer[] {
  return MC_SERVER_META.map((m, i) => ({
    id: m.id,
    name: m.name,
    host: m.host,
    port: m.port,
    serverId: m.serverId,
    version: m.version,
    motd: m.motd,
    status: "online" as McStatus,
    players: i === 2 ? Math.floor(Math.random() * 12) : Math.floor(Math.random() * 6),
    maxPlayers: m.maxPlayers,
    tps: i === 3 ? 17 + Math.random() * 1.8 : 19.4 + Math.random() * 0.6,
    latencyMs: 10 + Math.random() * 20,
    lastPingAt: new Date().toISOString(),
    memUsedMb: (i === 0 ? 2600 : i === 1 ? 1700 : i === 2 ? 1400 : 3800) + Math.random() * 300,
    memMaxMb: 4096,
  }));
}

/* ------------------------------- 模块状态 ------------------------------- */

let servers: ServerInfo[] = buildServers();
let histories: Map<string, ServerMetricPoint[]> = new Map(
  SERVER_META.map((m, i) => [
    m.id,
    Array.from({ length: POINTS }, (_, k) => seedPoint(k, i)),
  ])
);
let netTotals: Record<string, { inBytes: number; outBytes: number }> = {
  "srv-main": { inBytes: 812 * 1024 ** 3, outBytes: 441 * 1024 ** 3 },
  "srv-build": { inBytes: 3.2 * 1024 ** 4, outBytes: 1.1 * 1024 ** 4 },
};
let disks: Record<string, ServerDisk[]> = {
  "srv-main": makeDisks(0),
  "srv-build": makeDisks(1),
};
let mcServers: MinecraftServer[] = buildMc();
let lastTick = 0;

/* ------------------------------- 推进逻辑 ------------------------------- */

function advanceOnce(): void {
  for (let s = 0; s < servers.length; s++) {
    const id = servers[s].id;
    const list = histories.get(id)!;
    const prev = list[list.length - 1];

    const memBase = s === 0 ? 52 : 61;
    const cpuBase = s === 0 ? 34 : 42;
    const spike = Math.random() < 0.06;
    const cpu = spike
      ? 72 + Math.random() * 22
      : walk(prev.cpuPercent, 3, 97, 6, cpuBase, 0.22);
    const mem = walk(prev.memPercent, 20, 92, 1.4, memBase, 0.06);
    const disk = clamp(prev.diskPercent + (Math.random() - 0.5) * 0.03, 0, 99.5);

    const burstIn = Math.random() < 0.12;
    const burstOut = Math.random() < 0.12;
    const netIn = netWalk(prev.netInBps, burstIn ? (40 + Math.random() * 80) * 1e6 : (0.6 + Math.random() * 3) * 1e6);
    const netOut = netWalk(prev.netOutBps, burstOut ? (25 + Math.random() * 50) * 1e6 : (0.3 + Math.random() * 2) * 1e6);

    const processCount = Math.round(walk(prev.processCount, 150, 340, 18, 235, 0.05));

    list.push({
      timestamp: new Date().toISOString(),
      cpuPercent: cpu,
      memPercent: mem,
      diskPercent: disk,
      netInBps: netIn,
      netOutBps: netOut,
      processCount,
      temperature: null,
    });
    if (list.length > POINTS) list.shift();

    // 网络累计流量(按时间片估算,用于详情页总流量)
    const totals = (netTotals[id] ??= { inBytes: 0, outBytes: 0 });
    totals.inBytes += Math.round((netIn * STEP_MS) / 8);
    totals.outBytes += Math.round((netOut * STEP_MS) / 8);

    // 依据 CPU 判断服务器状态
    servers[s].status = cpu > 88 ? "degraded" : cpu < 2.5 ? "offline" : "online";
    servers[s].uptimeSeconds += 1;
  }

  // MC 服务器状态推进
  for (let m = 0; m < mcServers.length; m++) {
    const mc = mcServers[m];
    mc.lastPingAt = new Date().toISOString();
    mc.latencyMs = clamp(walk(mc.latencyMs, 6, 90, 4, m === 2 ? 35 : 18, 0.3), 6, 90);

    if (mc.status === "online") {
      const max = mc.maxPlayers;
      // 玩家数随机进出(约 20% 概率大波动 ±3,平时 ±1)
      const delta = Math.random() < 0.2 ? Math.floor(Math.random() * 7) - 3 : Math.floor(Math.random() * 3) - 1;
      mc.players = clamp(mc.players + delta, 0, max);
      // TPS:模组服略低,且带抖动
      const tpsBase = m === 3 ? 17.6 : 19.7;
      mc.tps = clamp(walk(mc.tps, 12, 20, 0.4, tpsBase, 0.35), 12, 20);
      const memBase = [2600, 1700, 1400, 3800][m];
      mc.memUsedMb = Math.round(clamp(walk(mc.memUsedMb, 900, 4000, 40, memBase, 0.1), 900, 4000));
    } else if (mc.status === "starting" || mc.status === "stopping") {
      // 过渡状态持续推进
    }
  }
}

function ensureTick(): void {
  const now = Date.now();
  if (now - lastTick >= TICK_MIN_INTERVAL) {
    lastTick = now;
    advanceOnce();
  }
}

/* ------------------------------- 对外接口 ------------------------------- */

export function getServers(): ServerInfo[] {
  ensureTick();
  return servers;
}

export function getServerHistory(serverId: string): ServerHistory {
  ensureTick();
  return { serverId, points: histories.get(serverId) ?? [] };
}

export function getServerSummary(serverId: string): ServerSummary {
  ensureTick();
  const list = histories.get(serverId) ?? [];
  const last = list[list.length - 1];
  const totals = netTotals[serverId];
  const info = servers.find((s) => s.id === serverId);
  return {
    serverId,
    cpuPercent: last?.cpuPercent ?? 0,
    memPercent: last?.memPercent ?? 0,
    diskPercent: last?.diskPercent ?? 0,
    netInBps: last?.netInBps ?? 0,
    netOutBps: last?.netOutBps ?? 0,
    netTotalInBytes: totals?.inBytes ?? 0,
    netTotalOutBytes: totals?.outBytes ?? 0,
    processCount: last?.processCount ?? 0,
    temperature: last?.temperature ?? null,
    disks: disks[serverId] ?? [],
  };
}

export function getMcServers(): MinecraftServer[] {
  ensureTick();
  return mcServers;
}

/** Mock 物理硬盘(含直通给虚拟机的盘) */
export function mockPhysicalDisks(serverId: string): PhysicalDisk[] {
  const defs =
    serverId === "srv-main"
      ? [
          { name: "0", model: "Samsung SSD 980 PRO 1TB", sizeBytes: 1024 ** 4 },
          { name: "1", model: "Seagate IronWolf 12TB", sizeBytes: 12 * 1024 ** 4 },
          { name: "2", model: "WD Red Plus 8TB (直通)", sizeBytes: 8 * 1024 ** 4 },
        ]
      : [
          { name: "0", model: "Samsung SSD 990 PRO 2TB", sizeBytes: 2 * 1024 ** 4 },
          { name: "1", model: "Seagate Exos 16TB (直通)", sizeBytes: 16 * 1024 ** 4 },
        ];
  return defs.map((d) => ({
    ...d,
    status: "OK",
    readBps: Math.round((3 + Math.random() * 30) * 1e6),
    writeBps: Math.round((2 + Math.random() * 20) * 1e6),
    activityPercent: Math.round(3 + Math.random() * 45),
  }));
}

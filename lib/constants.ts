import type { McStatus, ServerStatus } from "@/lib/types";

/** 指标语义色(图表 / 进度条统一使用) */
export const CPU_COLOR = "#0891b2"; // cyan-600
export const MEM_COLOR = "#d97706"; // amber-600
export const DISK_COLOR = "#7c3aed"; // violet-600
export const NET_IN_COLOR = "#10b981"; // emerald-500
export const NET_OUT_COLOR = "#3b82f6"; // blue-500
export const TEMP_COLOR = "#ef4444"; // red-500

/** 物理服务器静态元信息(Mock 阶段;接入真实数据后可迁移到配置/接口) */
export interface ServerMeta {
  id: string;
  name: string;
  short: string;
  color: string;
  hostname: string;
  ip: string;
  os: string;
  cpuModel: string;
  cpuCores: number;
  totalMemBytes: number;
  totalDiskBytes: number;
}

export const SERVER_META: ServerMeta[] = [
  {
    id: "srv-main",
    name: "物理机 1",
    short: "1",
    color: "#0f766e", // teal-700
    hostname: "MAIN-01",
    ip: "192.168.1.10",
    os: "Windows Server 2022",
    cpuModel: "Intel Xeon E5-2680 v4",
    cpuCores: 8,
    totalMemBytes: 32 * 1024 ** 3,
    totalDiskBytes: 1024 ** 4,
  },
  {
    id: "srv-build",
    name: "物理机 2",
    short: "2",
    color: "#4f46e5", // indigo-600
    hostname: "BUILD-02",
    ip: "192.168.1.11",
    os: "Windows Server 2022",
    cpuModel: "AMD Ryzen 9 7950X",
    cpuCores: 16,
    totalMemBytes: 64 * 1024 ** 3,
    totalDiskBytes: 2 * 1024 ** 4,
  },
];

/** MC 服务器静态元信息 */
export interface McServerMeta {
  id: string;
  name: string;
  host: string;
  port: number;
  serverId: string;
  version: string;
  motd: string;
  maxPlayers: number;
}

export const MC_SERVER_META: McServerMeta[] = [
  {
    id: "mc-survival",
    name: "生存服",
    host: "192.168.1.10",
    port: 25565,
    serverId: "srv-main",
    version: "1.21.1",
    motd: "生存服 · 原版",
    maxPlayers: 20,
  },
  {
    id: "mc-creative",
    name: "创造服",
    host: "192.168.1.10",
    port: 25566,
    serverId: "srv-main",
    version: "1.21.1",
    motd: "创造服 · 建筑",
    maxPlayers: 10,
  },
  {
    id: "mc-lobby",
    name: "大厅服",
    host: "192.168.1.11",
    port: 25565,
    serverId: "srv-build",
    version: "1.20.4",
    motd: "大厅 · 小游戏",
    maxPlayers: 100,
  },
  {
    id: "mc-modded",
    name: "模组服",
    host: "192.168.1.11",
    port: 25567,
    serverId: "srv-build",
    version: "Forge 1.20.1",
    motd: "模组服 · 整合包",
    maxPlayers: 16,
  },
];

/** 服务器状态 → 标签样式 */
export const SERVER_STATUS_META: Record<
  ServerStatus,
  { label: string; badge: string; dot: string }
> = {
  online: {
    label: "在线",
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-400",
  },
  degraded: {
    label: "负载偏高",
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-400",
  },
  offline: {
    label: "离线",
    badge: "bg-red-500/10 text-red-600 dark:text-red-400",
    dot: "bg-red-400",
  },
};

/** MC 服务器状态 → 标签样式 */
export const MC_STATUS_META: Record<McStatus, { label: string; badge: string; dot: string }> = {
  online: {
    label: "在线",
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-400",
  },
  starting: {
    label: "启动中",
    badge: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    dot: "bg-sky-400",
  },
  stopping: {
    label: "停止中",
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-400",
  },
  offline: {
    label: "离线",
    badge: "bg-red-500/10 text-red-600 dark:text-red-400",
    dot: "bg-red-400",
  },
  crash: {
    label: "已崩溃",
    badge: "bg-red-500/10 text-red-600 dark:text-red-400",
    dot: "bg-red-400",
  },
};

/** TPS 分级(满 20) */
export function tpsTone(tps: number): { text: string; bar: string } {
  if (tps >= 18) return { text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-400" };
  if (tps >= 14) return { text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-400" };
  return { text: "text-red-600 dark:text-red-400", bar: "bg-red-400" };
}

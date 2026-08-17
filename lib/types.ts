/**
 * 统一数据类型定义
 * 前端所有组件与 API 路由均基于这些类型,接入真实数据源(windows_exporter / MC 状态导出器)时无需修改组件。
 */

/** 物理服务器运行状态 */
export type ServerStatus = "online" | "degraded" | "offline";

/** 物理服务器基础信息(变化频率低) */
export interface ServerInfo {
  id: string;
  name: string;
  /** 短标识,用于色块 */
  short: string;
  /** 品牌色(低饱和),用于图表与色块 */
  color: string;
  hostname: string;
  ip: string;
  os: string;
  cpuModel: string;
  cpuCores: number;
  totalMemBytes: number;
  totalDiskBytes: number;
  uptimeSeconds: number;
  status: ServerStatus;
}

/** 服务器磁盘分区 */
export interface ServerDisk {
  mount: string;
  label: string;
  totalBytes: number;
  usedBytes: number;
  filesystem: string;
}

/** 物理硬盘(含直通给虚拟机的盘) */
export interface PhysicalDisk {
  /** 磁盘索引,如 "0" */
  name: string;
  model: string;
  sizeBytes: number;
  status: string;
  readBps: number;
  writeBps: number;
  /** 读写忙时占比 0-100 */
  activityPercent: number;
}

/** 单个时间点的服务器指标快照 */
export interface ServerMetricPoint {
  timestamp: string; // ISO 8601
  cpuPercent: number;
  memPercent: number;
  diskPercent: number;
  netInBps: number;
  netOutBps: number;
  processCount: number;
  /** Windows 温度传感器支持有限,无数据时为 null */
  temperature: number | null;
}

/** 服务器指标时间序列(最近 N 个点) */
export interface ServerHistory {
  serverId: string;
  points: ServerMetricPoint[];
}

/** 物理服务器聚合摘要(详情页 KPI 用) */
export interface ServerSummary {
  serverId: string;
  cpuPercent: number;
  memPercent: number;
  diskPercent: number;
  netInBps: number;
  netOutBps: number;
  netTotalInBytes: number;
  netTotalOutBytes: number;
  processCount: number;
  temperature: number | null;
  disks: ServerDisk[];
}

/** Minecraft 服务器运行状态 */
export type McStatus = "online" | "starting" | "stopping" | "offline" | "crash";

/** MC 服务器节点(单个 ping 目标) */
export interface McNode {
  id: string;
  /** 显性地址:展示给玩家的连接地址(不带端口) */
  display: string;
  /** 隐形地址:用于检测在线状态的主机 */
  host: string;
  /** 隐形地址:检测用的端口 */
  port: number;
  /** 节点位置,如"山东节点" */
  location?: string;
  online: boolean;
  version: string;
  motd: string;
  players: number;
  maxPlayers: number;
  latencyMs: number;
  lastPingAt: string;
}

/** MC 服务器(含多个网络节点) */
export interface McServerGroup {
  id: string;
  name: string;
  onlineNodes: number;
  totalNodes: number;
  totalPlayers: number;
  nodes: McNode[];
}

/** Minecraft 服务器信息 */
export interface MinecraftServer {
  id: string;
  name: string;
  host: string;
  port: number;
  /** 所属物理服务器 id */
  serverId: string;
  version: string;
  motd: string;
  status: McStatus;
  players: number;
  maxPlayers: number;
  /** ticks per second,满 20 */
  tps: number;
  latencyMs: number;
  lastPingAt: string;
  memUsedMb: number;
  memMaxMb: number;
}

/** API 统一返回格式 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  cachedAt?: string;
}

/** 趋势图时间范围 */
export type HistoryRange = "1h" | "24h" | "7d";

/** 百分比:42.3%(小数位可选) */
export function formatPercent(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

/** 字节格式化:512 B / 12.4 GB */
export function formatBytes(bytes: number): string {
  const abs = Math.abs(bytes);
  if (abs >= 1 << 30) return `${(bytes / (1 << 30)).toFixed(1)} GB`;
  if (abs >= 1 << 20) return `${(bytes / (1 << 20)).toFixed(1)} MB`;
  if (abs >= 1 << 10) return `${(bytes / (1 << 10)).toFixed(1)} KB`;
  return `${bytes} B`;
}

/** 速率格式化:1.2 MB/s(B/s → KB/s / MB/s) */
export function formatRate(bytesPerSec: number): string {
  const abs = Math.abs(bytesPerSec);
  if (abs >= 1 << 20) return `${(bytesPerSec / (1 << 20)).toFixed(1)} MB/s`;
  if (abs >= 1 << 10) return `${(bytesPerSec / (1 << 10)).toFixed(1)} KB/s`;
  return `${bytesPerSec.toFixed(0)} B/s`;
}

/** 表格时间:07-27 14:03 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}-${dd} ${hh}:${mi}`;
}

/** 图表 X 轴时间:14:03(跨天显示 07-27 14:03) */
export function formatAxisTime(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const today = new Date();
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  return isToday ? `${hh}:${mi}` : `${mm}-${dd} ${hh}:${mi}`;
}

/** 时钟:14:03:25 */
export function formatClock(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 运行时长:3 天 04:12 或 12:34:56 */
export function formatUptime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const days = Math.floor(s / 86400);
  const hh = Math.floor((s % 86400) / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (days > 0) return `${days} 天 ${pad(hh)}:${pad(mm)}:${pad(ss)}`;
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}


import { cn } from "@/lib/utils";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** 指标进度条(CPU / 内存 / 磁盘 占用率) */
export function MetricBar({
  percent,
  color,
  className,
  trackClassName,
}: {
  percent: number;
  color: string;
  className?: string;
  trackClassName?: string;
}) {
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-secondary", trackClassName)}
      role="progressbar"
      aria-valuenow={Math.round(clamp(percent, 0, 100))}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${clamp(percent, 0, 100)}%`, background: color }}
      />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Count-up 动画 hook:数值从当前值平滑过渡到目标值。
 * - 首次加载从 0 增长到目标值(默认 1000ms,easeOutQuart 缓动)
 * - 数据刷新后从旧值过渡到新值
 * - 遵循 prefers-reduced-motion:直接跳变,无动画
 */
export function useCountUp(target: number, duration = 1000): number {
  const reducedMotion = useReducedMotion();
  const [value, setValue] = useState(0);
  const displayRef = useRef(0);

  useEffect(() => {
    if (reducedMotion || duration <= 0) {
      displayRef.current = target;
      setValue(target);
      return;
    }

    const from = displayRef.current;
    if (from === target) return;

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 4); // easeOutQuart
      const current = from + (target - from) * eased;
      displayRef.current = current;
      setValue(current);
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reducedMotion]);

  return value;
}

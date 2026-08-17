"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Blocks, LayoutDashboard, RefreshCw, Server } from "lucide-react";
import { useRefresh, useServers } from "@/lib/hooks";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

const NAV_ITEMS = [
  { href: "/", label: "MC 服务器", icon: Blocks, exact: true },
  { href: "/hardware", label: "硬件监测", icon: LayoutDashboard, exact: false },
];

export function Header() {
  const pathname = usePathname();
  const { dataUpdatedAt, isFetching } = useServers();
  const refresh = useRefresh();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const refreshing = isFetching || refresh.isPending;
  const updatedText = mounted && dataUpdatedAt ? formatClock(new Date(dataUpdatedAt)) : "--:--:--";

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0f172a] text-slate-200 shadow-sm">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-400">
            <Server className="size-4.5" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-sm font-semibold tracking-tight text-white">Server Monitor</span>
          </span>
        </Link>

        <nav className="ml-2 flex items-center gap-1 sm:ml-6">
          {NAV_ITEMS.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors duration-150",
                  active ? "text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                )}
              >
                <item.icon className="size-3.5" />
                <span className="hidden sm:inline">{item.label}</span>
                {active && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute inset-x-2 -bottom-[13px] h-0.5 rounded-full bg-emerald-400"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <span className="hidden items-center gap-1.5 font-mono text-xs text-slate-400 sm:flex">
            <span className={cn("size-1.5 rounded-full", refreshing ? "bg-amber-400" : "bg-emerald-400")} />
            {updatedText}
          </span>
          <button
            type="button"
            onClick={() => refresh.mutate()}
            disabled={refreshing}
            aria-label="手动刷新数据"
            title="手动刷新"
            className="inline-flex size-8 items-center justify-center rounded-md text-slate-300 transition-colors duration-150 hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            <motion.span
              animate={{ rotate: refreshing ? 360 : 0 }}
              transition={refreshing ? { repeat: Infinity, duration: 0.9, ease: "linear" } : { duration: 0.3 }}
              className="flex"
            >
              <RefreshCw className="size-4" />
            </motion.span>
          </button>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

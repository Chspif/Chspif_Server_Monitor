"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const THEME_KEY = "sm-monitor:theme";

/** 暗色模式切换(类式 dark mode,持久化到 localStorage) */
export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      window.localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {
      // ignore
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "切换到浅色模式" : "切换到暗色模式"}
      className="inline-flex size-8 items-center justify-center rounded-md text-slate-300 transition-colors duration-150 hover:bg-white/10 hover:text-white"
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

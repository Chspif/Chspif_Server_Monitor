import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-3 py-20">
      <span className="flex size-10 items-center justify-center rounded-lg bg-slate-500/10 text-slate-400">
        <Compass className="size-5" />
      </span>
      <h1 className="text-lg font-semibold tracking-tight">页面不存在</h1>
      <p className="text-muted-foreground font-mono text-xs">404 · Page Not Found</p>
      <Link href="/" className="text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline">
        返回总览
      </Link>
    </div>
  );
}

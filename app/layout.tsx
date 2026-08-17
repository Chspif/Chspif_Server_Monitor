import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppProviders } from "@/components/layout/app-providers";
import { Header } from "@/components/layout/Header";

export const metadata: Metadata = {
  title: "Server Monitor",
};

/**
 * 在首屏渲染前应用已保存的主题,避免暗色模式闪烁(FOUC)。
 */
const themeInitScript = `(function(){try{var t=window.localStorage.getItem("sm-monitor:theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark");}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <AppProviders>
          <Header />
          <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
          <footer className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
            <p className="text-muted-foreground text-center font-mono text-xs">
              Server Monitor · By lyjdtz
            </p>
          </footer>
        </AppProviders>
      </body>
    </html>
  );
}

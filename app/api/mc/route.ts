import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { mcPing, resolveMcAddress } from "@/lib/mc-ping";
import type { McNode, McServerGroup } from "@/lib/types";

export const dynamic = "force-dynamic";

/** mc-servers.json 节点配置:显性地址展示,隐形地址检测 */
interface McNodeConfig {
  /** 显性地址:展示给玩家的连接地址(不带端口) */
  display?: string;
  /** 隐形地址:用于检测在线状态,支持 纯域名 / 域名:端口 / host + port 分离 */
  check: string;
  location?: string;
}
interface McServerConfig {
  name: string;
  nodes: McNodeConfig[];
}

const DEFAULT_MC_PORT = 25565;
const CACHE_TTL_MS = 30_000;
let cache: { ts: number; data: McServerGroup[] } | null = null;

/** 读取 mc-servers.json,用户在文件中按"服务器 → 节点"添加即可 */
function loadConfig(): McServerConfig[] {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "mc-servers.json"), "utf8");
    const parsed = JSON.parse(raw) as McServerConfig[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("[mc] mc-servers.json load failed:", err);
    return [];
  }
}

/** 解析检测地址:兼容 纯域名(默认端口/SRV) / 域名:端口 / host + port 分离 */
function parseNode(address: string): {
  host: string;
  port: number;
  explicitPort: boolean;
} {
  let host = address.trim();
  let port = DEFAULT_MC_PORT;
  let explicitPort = false;
  const idx = host.lastIndexOf(":");
  if (idx > 0 && /^\d+$/.test(host.slice(idx + 1))) {
    port = parseInt(host.slice(idx + 1), 10);
    host = host.slice(0, idx);
    explicitPort = true;
  }
  return { host, port, explicitPort };
}

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.ts < CACHE_TTL_MS) {
    return NextResponse.json({
      success: true,
      data: cache.data,
      cachedAt: new Date().toISOString(),
    });
  }

  const configs = loadConfig();

  const results: McServerGroup[] = await Promise.all(
    configs.map(async (c): Promise<McServerGroup> => {
      const nodes: McNode[] = await Promise.all(
        c.nodes.map(async (n, ni): Promise<McNode> => {
          const parsed = parseNode(n.check);
          // 未显式指定端口时,查 Minecraft SRV 记录获取真实地址
          const resolved = parsed.explicitPort
            ? { host: parsed.host, port: parsed.port }
            : await resolveMcAddress(parsed.host);
          const ping = await mcPing(resolved.host, resolved.port);
          if (!ping.online) {
            console.warn(`[mc] ping failed: ${n.check} -> ${resolved.host}:${resolved.port}`);
          }
          return {
            id: `${c.name}-${ni}`,
            // 显性地址展示给玩家;未配置时回退用检测主机名
            display: n.display?.trim() || parsed.host,
            host: resolved.host,
            port: resolved.port,
            location: n.location,
            online: ping.online,
            version: ping.version ?? "未知版本",
            motd: ping.motd ?? "",
            players: ping.players ?? 0,
            maxPlayers: ping.maxPlayers ?? 0,
            latencyMs: ping.latencyMs ?? 0,
            lastPingAt: new Date().toISOString(),
          };
        })
      );

      return {
        id: c.name,
        name: c.name,
        onlineNodes: nodes.filter((n) => n.online).length,
        totalNodes: nodes.length,
        totalPlayers: nodes.reduce((s, n) => s + n.players, 0),
        nodes,
      };
    })
  );

  cache = { ts: now, data: results };
  return NextResponse.json({ success: true, data: results, cachedAt: new Date().toISOString() });
}

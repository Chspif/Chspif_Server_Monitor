/**
 * Minecraft Server List Ping(服务端使用)
 * 通过 Minecraft 服务器列表协议(1.7+)探测服务器状态:
 * 在线状态 / 版本 / MOTD / 玩家数 / 延迟。
 * 纯 Node net 实现,无外部依赖。
 */

import net from "net";
import dns from "dns";

export interface McPingResult {
  online: boolean;
  version?: string;
  motd?: string;
  players?: number;
  maxPlayers?: number;
  latencyMs?: number;
}

/** Minecraft 默认端口 */
export const DEFAULT_MC_PORT = 25565;

/**
 * 解析不带端口的域名地址:
 * MC 客户端对纯域名会先查 _minecraft._tcp.<domain> 的 SRV 记录,
 * 命中则用记录里的目标主机和端口,否则回退默认 25565。
 */
export async function resolveMcAddress(
  host: string
): Promise<{ host: string; port: number }> {
  try {
    const records = await dns.promises.resolveSrv(`_minecraft._tcp.${host}`);
    if (records && records.length > 0 && records[0].name) {
      const target = records[0].name.replace(/\.$/, "");
      if (target) return { host: target, port: records[0].port };
    }
  } catch {
    // 无 SRV 记录或查询失败,回退默认端口
  }
  return { host, port: DEFAULT_MC_PORT };
}

function writeVarInt(n: number): Buffer {
  const bytes: number[] = [];
  do {
    let b = n & 0x7f;
    n >>>= 7;
    if (n > 0) b |= 0x80;
    bytes.push(b);
  } while (n > 0);
  return Buffer.from(bytes);
}

function readVarInt(data: Buffer, offset: number): { value: number; size: number } {
  let value = 0;
  let size = 0;
  let b: number;
  do {
    b = data[offset + size];
    value |= (b & 0x7f) << (7 * size);
    size++;
    if (size > 5) throw new Error("VarInt too big");
  } while (b & 0x80);
  return { value, size };
}

function packet(parts: Buffer[]): Buffer {
  const payload = Buffer.concat(parts);
  return Buffer.concat([writeVarInt(payload.length), payload]);
}

/** 去掉 MOTD 里的 § 颜色码 */
function cleanMotd(input: unknown): string {
  let text = "";
  if (typeof input === "string") text = input;
  else if (input && typeof input === "object") {
    const obj = input as { text?: unknown; extra?: unknown[] };
    text = String(obj.text ?? "");
    if (Array.isArray(obj.extra)) {
      for (const part of obj.extra) text += cleanMotd(part);
    }
  }
  return text.replace(/§[0-9a-fk-or]/g, "").trim();
}

/**
 * 对单个 MC 服务器发起 Server List Ping。
 * 超时或连接失败视为 offline,resolve 不抛错。
 */
export function mcPing(host: string, port: number, timeoutMs = 3_000): Promise<McPingResult> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let buffer = Buffer.alloc(0);
    let settled = false;
    const start = Date.now();

    const finish = (res: McPingResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(res);
    };

    socket.setTimeout(timeoutMs, () => finish({ online: false }));
    socket.on("error", () => finish({ online: false }));
    socket.on("close", () => finish({ online: false }));

    socket.on("connect", () => {
      const address = Buffer.from(host, "utf8");
      const handshake = packet([
        Buffer.from([0x00]), // packet id: handshake
        writeVarInt(-1), // protocol version(列表 ping 用 -1)
        writeVarInt(address.length),
        address,
        Buffer.from([(port >> 8) & 0xff, port & 0xff]),
        writeVarInt(1), // next state: status
      ]);
      socket.write(handshake);
      socket.write(packet([Buffer.from([0x00])])); // status request
    });

    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      try {
        const { value: packetLen, size } = readVarInt(buffer, 0);
        if (buffer.length < size + packetLen) return; // 数据不完整,等待
        const jsonStart = size + 1; // 跳过 packet length + packet id(0x00)
        const { value: jsonLen, size: jsonLenSize } = readVarInt(buffer, jsonStart);
        const jsonOffset = jsonStart + jsonLenSize;
        const jsonText = buffer.subarray(jsonOffset, jsonOffset + jsonLen).toString("utf8");
        const data = JSON.parse(jsonText) as {
          version?: { name?: string };
          description?: unknown;
          players?: { online?: number; max?: number };
        };
        finish({
          online: true,
          version: data.version?.name,
          motd: cleanMotd(data.description),
          players: data.players?.online,
          maxPlayers: data.players?.max,
          latencyMs: Date.now() - start,
        });
      } catch {
        // 包未收全或解析失败,继续等待下一个 chunk
      }
    });
  });
}

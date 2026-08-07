import type { RuntimeEnv } from "@tarot/runtime";

function randomHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * 浏览器 / PWA 运行时环境实现。
 * 用 WebCrypto 取代桌面端的 node:crypto，隔离在 RuntimeEnv 端口之后。
 * 未来走 Capacitor 原生时可替换为原生实现而不动业务逻辑。
 */
export const browserEnv: RuntimeEnv = {
  uuid: () => (typeof crypto.randomUUID === "function" ? crypto.randomUUID() : randomHex(16)),
  seed: () => randomHex(24),
  now: () => new Date().toISOString(),
};

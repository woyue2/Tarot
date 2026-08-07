import { cpSync, createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const RESOURCES_DIR = resolve(__dirname, "../../resources");
const CARDS_DIR = join(RESOURCES_DIR, "cards");

const MIME: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

/**
 * 手机端复用桌面端同一份牌面资源（resources/cards/*.webp），路径与桌面端
 * App.tsx 保持一致（/cards/card-back.webp、/cards/major-00.webp）。
 * - dev：中间件把 /cards/* 直接映射到 resources/cards，无需复制。
 * - build：把 resources/cards 拷进 dist/cards。
 * 这样 apps/mobile/public 只放 PWA manifest 与图标，不污染共享 resources。
 */
function serveSharedCards(): Plugin {
  return {
    name: "tarot-serve-shared-cards",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0];
        if (!url || !url.startsWith("/cards/")) return next();
        const filePath = join(CARDS_DIR, url.slice("/cards/".length));
        if (!filePath.startsWith(CARDS_DIR) || !existsSync(filePath) || !statSync(filePath).isFile()) {
          return next();
        }
        res.setHeader("Content-Type", MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream");
        res.setHeader("Cache-Control", "public, max-age=3600");
        createReadStream(filePath).pipe(res);
      });
    },
    closeBundle() {
      const outDir = resolve(__dirname, "dist", "cards");
      if (!existsSync(CARDS_DIR)) return;
      mkdirSync(outDir, { recursive: true });
      cpSync(CARDS_DIR, outDir, { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), serveSharedCards()],
  server: {
    host: true,
    port: 5273,
  },
  build: {
    target: "es2022",
    outDir: "dist",
  },
});

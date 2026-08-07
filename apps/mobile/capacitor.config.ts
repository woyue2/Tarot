import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor 配置。
 *
 * - webDir：Vite 构建产物目录（vite.config.ts 中 build.outDir = "dist"）。
 * - appId：Android 反向域名格式，用作 Application ID 与包名。
 * - appName：Android launcher 显示名，与 manifest.webmanifest 的 name 对齐。
 * - android.backgroundColor：与 PWA background_color (#0e0f15) 一致，避免启动白屏。
 * - server.androidScheme：用 https 让 WebView 与 PWA 同源行为一致。
 *
 * 打包流程：
 *   pnpm --filter @tarot/mobile build   # 产出 dist/
 *   pnpm --filter @tarot/mobile cap:sync # npx cap sync（copy web 资源 + 更新原生插件）
 *   pnpm --filter @tarot/mobile cap:open # 在 Android Studio 打开 android/ 工程
 *   然后在 Android Studio 内 Build > Build APK(s) 出 debug APK
 */
const config: CapacitorConfig = {
  appId: "com.astryx.tarot",
  appName: "星径 · 塔罗",
  webDir: "dist",
  android: {
    backgroundColor: "#0e0f15",
    allowMixedContent: false,
  },
  server: {
    androidScheme: "https",
  },
  plugins: {
    // 启用 CapacitorHttp：在原生环境中自动 patch window.fetch，
    // 让 fetch 走原生 HTTP 层而非 WebView，绕过 WebView 的 CORS / 网络安全限制。
    // 这是 Capacitor 应用调用外部 API 的官方推荐方式。
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;

## ✅ 手机端预览（已运行）

- 本地浏览器：**http://localhost:4173/**
- 手机（同 WiFi）：**http://192.168.125.58:4173/**（局域网 IP 会变，以 `ipconfig | grep IPv4` 为准）
- 跑的是 17:14 的生产构建，已含 PWA 离线、拖动选牌、揭牌居中、R2 同步等全部已提交改动。
- 后台任务 id：`iRs4nO`，要停就告诉我（或我帮你关）。

## 📱 手机端命令（apps/mobile，Vite + React PWA）

```bash
# 开发预览（热更新，端口 5273，改代码即时生效）——日常开发用这个
pnpm --filter @tarot/mobile dev

# 生产构建（输出 dist/）
pnpm --filter @tarot/mobile build

# 预览生产构建（端口 4173，已为你起好这一条）
pnpm --filter @tarot/mobile preview --port 4173 --host
```

## 🖥️ 桌面端命令（apps/desktop，Electron）

```bash
# 开发（启动 Electron 应用窗口）
pnpm --filter @tarot/desktop dev

# 生产构建
pnpm --filter @tarot/desktop build

# 仅类型检查
pnpm --filter @tarot/desktop typecheck
```

## 🔧 根目录快捷

```bash
pnpm build       # 生成牌数据 + 全量构建（含两端）
pnpm typecheck   # 全量类型检查
pnpm check       # 生成数据 + typecheck + test + build（一键验收）
```

## ⚠️ 两个坑提醒

1. **重新构建手机端前，先停掉 4173 预览**。Windows 下预览进程会锁 `dist/`，此时再 `vite build`（emptyOutDir）会 EPERM 中断（日志卡在 128 modules transformed）。顺序：停预览 → build → 再起预览。
2. **桌面端 Electron 在本沙箱无运行时**，只能 `build` / `typecheck`；真正弹出窗口要在你本机装了 Electron 环境后跑 `pnpm --filter @tarot/desktop dev`。

------

cd c:\Users\Admin1\Documents\0Tarot\apps\mobile
pnpm --filter @tarot/mobile cap:sync
cd android
.\gradlew assembleDebug --no-daemon --console=plain

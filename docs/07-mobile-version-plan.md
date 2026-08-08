# 手机版本后续准备计划书

> 本文为「手机端」能力的后续准备计划。第一版明确 **不做** 手机端（见 `project_init.md` 第 3 节），但项目已在文档与代码层预留了复用空间。本文盘点已有基础、列出缺口，并给出 UI、交互、数据、打包与阶段化建议，供后续正式立项时直接使用。
> 配套依据：`project_init.md` 核心原则 11、`04-implementation-roadmap.md` Phase 2 / §9 Future、`05-ui-design-system.md` §6 / §9、以及 `apps/desktop/src/renderer/src/styles.css` 现有响应式规则。

## 0. 实施状态（2026-08-07 起已实际落地）

> 原本文档是「后续准备计划」。自 2026-08-07 起，手机端已从计划进入**实际工程落地**：在 monorepo 的预留槽位 `apps/mobile`（workspace 早已 `apps/*` 通配，无需改 `pnpm-workspace.yaml`）新建了可运行的移动端 App，并完成类型检查与生产构建验证。本节记录已落地的部分，供后续 Phase M0–M3 直接复用。

### 0.1 已落地的工程

- **工程骨架** `apps/mobile/`：Vite 7 + React 19 + TypeScript（继承 `tsconfig.base.json` 的严格开关：`exactOptionalPropertyTypes`、`noUncheckedIndexedAccess`）。
- **接口适配层（ports 实现，浏览器版）**：
  - `src/runtime/repository.ts`：`WebReadingRepository` 实现 `ReadingRepository + FolderRepository`，localStorage 持久化（已知 Gap：~5MB 上限，未来换 SQLite/IndexedDB）。
  - `src/runtime/environment.ts`：用 WebCrypto（`crypto.randomUUID` / `getRandomValues`）隔离 `RuntimeEnv`。
  - `src/runtime/model-provider.ts`：`FetchChatCompletionProvider` 走 OpenAI 兼容 `/chat/completions`，含 SSE 流式 `interpretStream`；内置 OpenAI / DeepSeek / Kimi / 通义千问 / 自定义预设。
  - `src/runtime/credentials.ts`：连接设置与 API Token 存储（已知 Gap：Web/PWA 无安全存储，明文存 localStorage；Capacitor 后换 Keychain/Keystore）。
  - `src/runtime/content.ts` + `service.ts`：复用 `resources/*.json` 内容包；`service.ts` 作为组合根把浏览器端口注入共享的 `ReadingService`。
- **共享业务层升级**：把桌面端 `apps/desktop/src/main/index.ts` 里内联的建牌 / 选牌 / 确认 / 解读编排**抽取到 `packages/runtime/src/reading-service.ts`**（`ReadingService`），桌面与手机复用同一份状态流转与契约（详见下方「关键决策」）。
- **UI 实现** `src/App.tsx` + `src/styles.css`：Home（问题 + 分组 chip + 手写/随缘两模式）/ 选牌（78 张横滑牌阵、Pointer Events + 44px、五张选择顺序 pip、重洗/清空/确认）/ 结果（揭牌横条、动量·价值指标、流式解读进度、逐张解读与脉络）/ 记录（列表 + 删除）/ 设置（Provider 预设、Base URL、模型、Token、测试连接、深色切换、安全提示）。底部三标签导航、安全区域 `env(safe-area-inset-*)`、`prefers-reduced-motion` 降级均已就位。
- **资源配置**：`vite.config.ts` 用 `serveSharedCards()` 插件把 `resources/cards/*.webp` 映射为 `/cards/*`（dev 中间件、build 拷贝到 `dist/cards`），与桌面端共用同一份牌面，不污染共享 `resources`；`public/manifest.webmanifest` + `icon.svg` 提供 PWA 入口。
- **验证**：`pnpm --filter @tarot/mobile typecheck` 通过；`vite build` 成功（126 模块，产物含 `dist/cards` 79 张 webp）；`vite preview` 冒烟测试 `index.html` / `/cards/*.webp`（image/webp）/ manifest / JS bundle 均 200。

### 0.2 关键决策

- **预留槽位即 `apps/mobile`**：workspace 已 `apps/*` 通配，新建即被纳入，无需改 workspace 配置。
- **业务逻辑上提到 runtime**：桌面端原本把编排内联在 IPC handler，手机端无法复用；将其抽取为平台无关的 `ReadingService`（依赖通过 ports 注入），是「写接口」请求的核心交付。手机端 UI 只依赖该单例。
- **资源零复制**：牌面与内容 JSON 直接复用 `resources/`，避免移动端另存一份。

### 0.3 仍待办（衔接原 Gap / Phase）

> 2026-08-07 本轮已补齐（详见 git log：aa95919 拖动选牌 / 4681f53 离线+导出 / 0926545 懒加载 / 54d5f25 桌面重构）：
> - 选牌已升级为 Pointer Events 拖动连续选牌（触摸不捕获指针保留横滑、鼠标捕获指针，复用 `selectedIndexes` 状态机）。
> - PWA 离线：手写 `public/sw.js`（导航 network-first、静态资源 stale-while-revalidate），生产构建注册；历史导出 JSON（不含密钥）。
> - 牌面懒加载：选牌屏只渲染同款牌背（1 次请求）、结果屏只解码 5 张正面，`decoding="async"` 防主线程阻塞。
> - 桌面端主进程已切到消费共享 `ReadingService`，桌面与手机共用同一份状态流转。
>
> 仍未做（环境/原生边界，非 PWA 代码缺口）：
- **Capacitor 原生容器 + 移动 SQLite + Keychain/Keystore（方向 B / Phase M2）**：当前为纯 PWA，无原生壳；API Token 与 R2 Sync Token 仍为 localStorage 明文，待 Capacitor 后换系统钥匙串。属单独构建目标，不在当前 PWA 工程范围内。
- **真机验收（Phase M0 / §10）**：需真实手机/模拟器逐条核对（360/600/1024 不破版、安全区避让、≥44px、触摸全流程、断网保留、reduced-motion、离线历史、低端机帧率）。沙箱无硬件，结构与 CSS 已就位，最终以真机为准。
- 摄像头魔法手势（Phase M3 可选）未实现。

### 0.4 本次新增：Cloudflare R2 云同步（手机端）

按 Worker 代理方案补齐了「设置里没有 R2 同步」的缺口：

- `apps/mobile/src/runtime/r2-client.ts`：`WorkerR2Client`，浏览器经 `fetch` 调用 Cloudflare Worker 代理（R2 密钥不进前端），API 表面对齐桌面 `r2-client.ts`（putJson/getJson/list/delete/testConnection）。
- `apps/mobile/src/runtime/r2-sync.ts`：平移桌面 `R2SyncService` 的双向同步逻辑，键布局 `readings/<id>.json` / `folders/<id>.json`——与桌面端**共用同一个桶**即可跨设备互相同步。
- `apps/mobile/src/runtime/credentials.ts` 新增 `R2Settings` 与 `loadR2Settings/saveR2Settings/getSyncToken/setSyncToken/clearSyncToken/isR2Configured`；`service.ts` 暴露 `createR2Sync()` 与 `testR2Connection()`。
- `App.tsx` 设置页新增「Cloudflare R2 云同步」卡片（启用 / Worker URL / Bucket / Sync Token / 测试连接 / 立即同步）；写操作（新建/解读/删除/分组）后自动推送，进入设置页后台自动双向同步。
- `apps/mobile/cloudflare-worker/`：可一键部署的 Worker 样本（`worker.js` + `wrangler.toml` + `README.md`），持有 R2 绑定与 `SYNC_TOKEN` 密钥，前端只调自己的 Worker 域名，**避免浏览器直连暴露 Access Key**。

**仍待办**：同步令牌（Sync Token）与 API Token 同属 `localStorage` 明文 Gap，Capacitor 后应换系统钥匙串（Keychain / Keystore）。

## 1. 目标与定位

- **复用优先**：手机端不重写业务逻辑，复用 Windows 第一版的选牌状态机、确定性计算、AI 输入契约与本地数据模型。
- **先可用再好用**：先把现有响应式 UI + 指针交互打磨到「真机能装、能选牌」，再投入 3D 仪式特效与摄像头手势。
- **不破坏核心原则**：程序定牌、确定性计算、本地数据、隐私提示等约束在手机端同样生效（见 `project_init.md` 第 6 节核心原则 1–12）。

## 2. 现状盘点（已有的「后路」）

手机端不是从零开始，以下基础已存在：

### 2.1 文档层决策

- `project_init.md` 原则 11：选牌「底层统一采用 Pointer Events，为未来手机触摸保留复用空间」——明确的设计意图。
- `04-implementation-roadmap.md` Phase 2：选牌状态机任务含「基于 Pointer Events 的鼠标拖动，并为触摸与触控笔复用」；验收含「360px 窄窗口下可以浏览、选择、取消并确认五张牌」「Chromium 模拟触摸下的滑动与选择」。
- `04-implementation-roadmap.md` §9 Future：已列出手机端方向——Capacitor 移动容器、移动 SQLite、安全凭据适配器、Android/iOS 真机校准、可选摄像头魔法手势（且须经同一选牌状态机、可撤销）。
- `05-ui-design-system.md` §6：输入方式不改变视觉语言——鼠标、键盘、触摸、触控笔、未来摄像头手势都映射到同一组 Astryx 选择/聚焦/确认/错误状态。
- `05-ui-design-system.md` §9：视觉验证已定义 360px / 600px / 1024px 关键响应式宽度，并明确「Windows 模拟触摸不能替代未来移动端真机手感测试」。

### 2.2 代码层已实现

- `apps/desktop/src/renderer/src/styles.css` 已写完整移动布局：
  - `@media (max-width: 760px)`（234–276 行）：侧边栏收成底部 58px tab 栏、内容区全宽、选牌入口单列堆叠、牌组横向滚动吸附、翻开牌变可左右滑动的卡片条、设置表单单列、错误提示与右下角齿轮避让底部导航。
  - `@media (pointer: coarse)`（278–282 行）：触摸设备统一 ≥44px 最小点按区，关掉 hover 抬升。
  - `.deck-scroller` 设 `touch-action: pan-x` + `scroll-snap-type`，原生触摸滑动可用。
- `apps/desktop/src/renderer/index.html` 已有 `<meta name="viewport" content="width=device-width, initial-scale=1.0">`，手机浏览器打开不会被缩成桌面版。
- 已存在深色「星夜」主题与 `prefers-reduced-motion` 降级，手机端可直接复用。

## 3. 仍缺失的部分（Gap）

| 缺口 | 现状 | 影响 |
|---|---|---|
| 选牌交互实际实现 | **已落地**：Pointer Events 拖动连续选牌（`onPointerDown/Move/Up` + `pointercancel`，鼠标捕获指针、触摸保留横滑），复用 `selectedIndexes` 状态机；键盘/单击仍走 `onClick` | 原则 11 的 Pointer Events 意图已真正落地 |
| 移动打包 | **已落地 PWA 外壳**（`apps/mobile` Vite + React + manifest，已通过构建与预览验证）；Capacitor 容器（Direction B）未做 | PWA 可直接在手机浏览器内测；上架 / TestFlight 仍走 Capacitor（§7 方向 B） |
| 移动数据与安全适配器 | 无移动 SQLite 封装、无 iOS Keychain / Android EncryptedSharedPreferences 等价物 | `safeStorage` 仅桌面可用 |
| 跨设备云同步 | **已落地**：手机端经 Cloudflare Worker 代理读写 R2（`apps/mobile/cloudflare-worker/`），密钥不暴露前端；与桌面端共用同一桶双向同步 | 同步令牌仍明文存 localStorage，待 Capacitor 安全存储替换 |
| 真机校准 | 无安全区域、惯性滚动、系统手势条避让的实机验证 | CSS 媒体查询是模拟，不等于真机手感 |
| 摄像头魔法手势 | 未实现，仅 roadmap §9 描述约束 | 属于 Phase M3 可选项 |
| 3D 翻牌工程化 | `scratch/prototype-3d-flip.html` 为独立 CDN 原型，未接入 Electron/移动工程 | 手机 GPU 性能未验证 |

## 4. UI 考量（已考虑 + 需补齐）

### 4.1 已考虑的 UI 原则（无需重做）

> 注意：Maka / Astryx 是**纯桌面** Agent 设计系统，本身没有手机端。因此移动端的**布局与交互模式不能直接照搬 Maka**，需另行参考真实有手机版、且移动端成熟的 AI 对话 / Agent 开源项目（见 §12）。Maka / Astryx 在本项目中的作用仍是提供桌面设计令牌与组件规范的基础，移动端在其之上叠加手机专属结构。

- 视觉语言统一：触摸不新建一套组件或状态色（`05-ui-design-system.md` §6）。
- 主题令牌驱动：颜色/间距/圆角来自 Tarot Theme，业务 CSS 不散落硬编码色（`05-ui-design-system.md` §8）。
- 响应式断点已定义：360 / 600 / 1024px（`05-ui-design-system.md` §9）。
- 粗指针 44px 点击区：`@media (pointer: coarse)` 已设。
- 减少动态效果：`prefers-reduced-motion` 已支持，手机端直接复用。
- 可达性：牌带语义、暗牌可访问名称、`aria-live` 播报、`已选择 N/5`（`05-ui-design-system.md` §9）在手机端同样适用。

### 4.2 手机端需补齐的 UI 细节

- **安全区域（Safe Area）**：底部 58px tab 栏与 `bottom:74px` 齿轮需叠加 `env(safe-area-inset-*)`，避让刘海、圆角与系统 home indicator。
- **系统手势冲突**：底部 tab 栏 58px 高度需真机确认不被 Android/iOS 底部手势条遮挡；横向选牌滑动与系统返回手势的边界处理。
- **逐组件点击区核对**：coarse 媒体查询只覆盖了 `.deck-card / .sidebar button / .connection-chip`，其余按钮（mode-card、sticky-actions、interpret-cta）需在真机逐一点检 ≥44px。
- **小屏字体重读**：13px caption、10px 品牌/日期在 360px 宽下的可读性；星夜主题在 OLED 上的对比度。
- **软键盘弹起**：问题输入框聚焦时软键盘升起，布局不得崩、不得遮盖确认按钮（监听 viewport resize / visualViewport）。
- **仪式特效性能**：魔法阵旋转、卡牌光泽、粒子在手机 GPU 上的发热与掉帧；沿用 roadmap §4 的「失焦降帧 / 减少动效 / 跳过」策略，并补充移动端低电量与高温降档。
- **横滑手感**：选牌横滑与结果五张横滑的惯性、吸附强度需在真机校准，避免过滑或过涩。

## 5. 交互层改造（Pointer Events 统一）

- 将选牌从「点击 + 原生滚动」升级为统一 Pointer Events：按下→拖动→抬起，鼠标 / 触摸 / 触控笔走同一套 `onPointerDown/Move/Up + setPointerCapture`。
- 复用同一选牌状态机，绝不直接写 `selectedIndexes` 或绕过「确认前可取消、确认后锁定」逻辑（`roadmap §9` 约束同样适用）。
- 处理 `pointercancel` 与拖出窗口：不残留拖动状态（roadmap Phase 2 验收已要求）。
- 触摸滑动选牌手感需在真机校准（阻尼、阈值、磁吸选择）。

## 6. 数据与安全

- **移动 SQLite 适配器**：iOS 需注意 WAL 模式与 app 组共享；Android 注意外部存储权限与备份排除。
- **凭据安全**：用 iOS Keychain / Android EncryptedSharedPreferences 替代桌面 `safeStorage`；API Key 不进 Renderer、不进日志（沿用核心原则 11）。
- **资源加载**：沿用 roadmap §4「牌带只加载牌背，确认后仅解码五张被选牌正面」的懒加载策略，控制首屏体积（78 张 webp 不宜一次性解码）。

## 7. 打包与分发

- **方向 A（推荐先做）PWA 外壳**：低成本把现有响应式 Web 跑在手机浏览器，验证 UI/交互与触摸选牌，无需签名即可内测。
- **方向 B Capacitor 容器**：roadmap §9 既定方向，原生壳接入本地 SQLite 与凭据适配器，可上架/TestFlight。
- 两种方向共享同一套 React renderer 与状态机，差异只在打包层与平台适配器。

## 8. 阶段化建议

- **Phase M0 — UI 审计与真机可见**：把现有响应式布局在真机/模拟器跑起来（即便先 PWA 壳）；补齐安全区域 inset；逐组件点检 44px；软键盘布局回归。验收：360/600/1024 三档不破版、不遮挡。
- **Phase M1 — 选牌 Pointer Events 统一 + 触摸选牌**：实现指针事件拖动选牌，复用状态机；模拟触摸 → 真机校准手感。验收：触摸可浏览/选择/取消/确认五张，断网保留牌面。
- **Phase M2 — Capacitor 容器 + 移动数据/凭据适配器**：接入移动 SQLite 与 Keychain/EncryptedSharedPreferences；离线可读历史。验收：重装/升级后数据不丢，Key 不泄露。
- **Phase M3 — 仪式特效手机调优 + 摄像头手势（可选）**：3D 翻牌/魔法阵性能降档；摄像头魔法手势须经同一状态机、可撤销、带隐私提示。验收：低端机 60fps 基线、减少动效可关、手势可撤销。

## 9. 风险

- **3D 翻牌性能**：低端 Android 上 WebGL 掉帧/发热；需提供「2D 翻转降级」开关。
- **架构差异**：Electron 主进程负责 AI 调用，移动端无主进程；要么移动端直连 API（Key 安全存储后），要么保留轻量本地推理接口（核心原则已预留本地模型接口）。
- **手势与滚动冲突**：横向选牌 vs 系统返回/纵向浏览，需在真机反复校准阈值。
- **真机不可替代性**：模拟触摸/响应式断点只能提前发现问题，最终以真机为准（roadmap §9 / UI §9 已强调）。

## 10. 真机验收清单（草案）

- [ ] 360 / 600 / 1024px 三档布局无破版、无遮挡
- [ ] 安全区域（刘海/圆角/底部条）正确避让
- [ ] 所有可点控件 ≥44px（真机点检）
- [ ] 触摸可完成：浏览牌带 → 选/取消 → 清空 → 重洗 → 确认五张
- [ ] 确认后牌序锁定，取消不偷偷重洗
- [ ] 断网可保留已确认牌面，恢复后继续同一次解读
- [ ] `prefers-reduced-motion` / 减少动效生效，不阻塞流程
- [ ] 离线可读历史、可导出（不含 API Key）
- [ ] 凭据不进 Renderer/日志；重装后数据可恢复
- [ ] 低端机翻牌/魔法阵不掉至 45fps 以下持续 1s（沿用 roadmap §4 基线）

## 11. 参考资料

- `project_init.md` 第 3 节（第一版不做手机端）、核心原则 11（Pointer Events 预留）
- `04-implementation-roadmap.md` Phase 2（选牌状态机）、§9 Future（移动端与摄像头手势）、桌面端测试（Pointer Events / 模拟触摸 / 关键宽度）
- `05-ui-design-system.md` §6（输入方式不改变视觉语言）、§8（CSS 与主题组织）、§9（视觉验证与可达性）
- `apps/desktop/src/renderer/src/styles.css` `@media (max-width: 760px)` / `@media (pointer: coarse)` / `touch-action`
- `apps/desktop/src/renderer/index.html` viewport meta

## 12. 移动 UI 参考项目（真实开源，GitHub 可查）

Maka / Astryx 无手机端，移动布局与交互不能照搬。以下均为真实存在、手机端成熟的开源 AI 对话 / Agent 项目，可作为移动 UI 与 PWA 落地的参考（均已核实仓库与 README 描述）：

### 12.1 ChatGPT-Next-Web（Yidadaa/ChatGPT-Next-Web）

- 地址：<https://github.com/Yidadaa/ChatGPT-Next-Web>
- 为何参考：跨平台（Web / PWA / 桌面 Tauri），响应式 + 深色模式 + PWA；README 与提交历史明确含「mobile ux」「fix: styles and mobile ux」等移动端优化。移动端聊天布局、可折叠侧边栏、输入框随键盘自适应是成熟实现。
- 可借用：移动端「消息流 + 底部贴键盘输入条」结构；窄屏下侧边栏折叠为抽屉；PWA 清单与离线缓存思路。

### 12.2 Lobe Chat（lobehub/lobe-chat）

- 地址：<https://github.com/lobehub/lobe-chat>
- 为何参考：开源 **AI Agent Workspace**（比纯聊天更接近本项目的 Agent 形态），明确支持 PWA 与「Mobile Device Adaptation」，仓库含专门的 `index.mobile.html` 移动入口；亮 / 暗主题、移动适配、本地数据存储。
- 可借用：Agent 工作区在手机的导航结构（桌面侧栏 → 移动底部标签 / 抽屉）；PWA 安装与原生感动画；移动端独立入口与布局文件的工程组织方式。

### 12.3 sycamore792/chatgpt（ChatGPT 像素级克隆）

- 地址：<https://github.com/sycamore792/chatgpt>
- 为何参考：宣称「Pixel-perfect UI matching OpenAI's ChatGPT」，响应式、移动友好、可折叠侧边栏，技术栈 Next.js + Tailwind。
- 可借用：移动端聊天主界面与侧边栏收起态的视觉与间距参考（若想对齐 ChatGPT 官方手机观感）。

### 12.4 diyorbekshokirov/ui_chat_gpt（ChatGPT Mobile 概念，Flutter）

- 地址：<https://github.com/diyorbekshokirov/ui_chat_gpt>
- 为何参考：纯移动 App UI 概念（Flutter），展示手机聊天界面、历史、设置等多屏导航。
- 可借用：若未来走原生 / Capacitor 路线，其底部标签与多屏导航结构可作原生手感参考（代码为 Flutter，仅参考交互与结构）。

### 12.5 参考使用原则

- 这些项目均为第三方许可证（ChatGPT-Next-Web 为 MIT，Lobe Chat 为 Apache-2.0 等），**只参考布局 / 交互思路，不复制代码**；若确需借鉴片段，保留其许可证与 NOTICE。
- 它们解决的是「AI 对话 / Agent 在手机上的通用框架」；本项目的**塔罗仪式层（魔法阵 / 翻牌 / 动量罗盘）与选牌状态机仍由自有规范与代码负责**，参考项目不替代 §4 / §5 的自有设计。

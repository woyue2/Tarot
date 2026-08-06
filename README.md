# Tarot Local Agent

一个本地优先的 Windows 塔罗桌面应用。当前版本已经可以完成问题输入、洗牌、自主或随机选五张牌、本地确定性计算、模型结构化解读和本地历史保存。

> 当前仓库处于可运行的早期 MVP 阶段。`docs/` 中同时保留了完整第一版的目标设计；尚未完成的能力以 [实现状态](docs/00-implementation-status.md) 为准。

## 环境要求

- Windows 10/11；
- Node.js 22 或更高版本；
- pnpm 11.9.x；
- 如需 AI 解读，需要可访问 OpenAI Responses API 的 API Key，或兼容该请求格式的服务。

## 快速开始

```powershell
pnpm --version
pnpm build
pnpm install
pnpm dev
```

首次启动后，可在“模型连接”页面填写：

- API 地址，例如 `https://api.openai.com/v1`；
- 模型名称；
- API Token。

Token 由 Electron `safeStorage` 加密后保存在本机。Renderer 只能读取“是否已配置”，不能读取明文 Token。

## 常用命令

```powershell
# 重新生成运行时卡牌资源
pnpm generate:content

# 类型检查
pnpm typecheck

# 单元测试
pnpm test

# 构建开发产物
pnpm build

# 生成资源、类型检查、测试并构建
pnpm check
```

## 当前已经实现

- Electron、React、TypeScript 桌面应用；
- 78 张牌及正逆位的确定性洗牌；
- 自主选五张与随机选五张；
- 固定评分、当前动量和当前路径价值计算；
- 结构化模型输出及 Zod 结果校验；
- SQLite 保存牌序、选择、计算、解读和 Folder；
- Electron `safeStorage` 保存 API Token；
- 本地历史浏览和 Folder 创建、重命名；
- 系统级 `prefers-reduced-motion` 动效降级。

## 当前主要限制

- 模型响应不是流式输出，尚不支持取消、超时和自动重试；
- 尚未实现事件日志、`agent_runs` 和崩溃后的运行过程回放；
- IPC 输入尚未全部统一使用 Zod；
- 自主选牌尚缺重新洗牌、清空选择、完整键盘导航和 Pointer Events 拖动；
- 随机模式目前会立即确认牌面，没有单独的牌背确认步骤；
- 尚未实现历史搜索、筛选、Markdown 导出、数据库备份恢复和日志轮转；
- 尚未提供 Windows 安装包、便携包和 Electron E2E 测试。

完整状态见 [docs/00-implementation-status.md](docs/00-implementation-status.md)。

## 文档导航

- [项目总览](project_init.md)
- [实现状态](docs/00-implementation-status.md)
- [产品体验与选牌交互](docs/01-product-experience.md)
- [Windows 本地架构](docs/02-technical-architecture.md)
- [Tarot Agent、数据与计算模型](docs/03-agent-data-model.md)
- [开发路线与验收标准](docs/04-implementation-roadmap.md)
- [Astryx UI 与视觉规范](docs/05-ui-design-system.md)
- [数据来源、版本与本地运维](docs/06-data-operations.md)

## 数据位置

开发源数据位于 `data/`，构建期生成的只读资源位于 `resources/`。运行时数据库、设置和加密凭据位于 Electron 为本应用返回的 `app.getPath("userData")` 目录；当前代码没有承诺固定的 `%APPDATA%` 子目录名称。


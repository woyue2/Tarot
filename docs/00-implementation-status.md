# 当前实现状态

更新日期：2026-08-04。

本文描述仓库当前代码，而其他产品、架构和路线图文档主要描述完整第一版的目标。状态含义：

- **已实现**：存在可运行代码，并有基本验证；
- **部分实现**：主流程可用，但尚未达到完整验收标准；
- **未实现**：仍是目标设计，不应视为当前产品承诺。

## 总体结论

当前仓库是可运行的早期 MVP：本地抽牌、确定性计算、结构化 AI 解读和历史保存已经连通。完整第一版仍缺流式 Runtime、事件记录、完整选牌交互、运维能力和正式打包。

## Phase 状态

| Phase | 状态 | 当前说明 |
|---|---|---|
| Phase 0：内容与规则规范化 | 部分实现 | 78 张牌、156 个方向评分、稳定 ID、ASCII 图片、版本化 JSON 和确定性计算已实现；独立 `AssetResolver` 尚未实现。 |
| Phase 1：Windows 桌面基础 | 部分实现 | Electron/React/SQLite/safeStorage/设置页/Folder 已实现；迁移框架、备份、首次引导、连接测试、会话删除和组件展示页未实现。 |
| Phase 2：选牌状态机 | 部分实现 | 固定种子、牌序、自主/随机选择、五张上限和确认已实现；重新洗牌、清空、草稿恢复、Pointer Events 拖动和完整键盘导航未实现。 |
| Phase 3：Tarot Agent 垂直流程 | 部分实现 | 输入契约、本地评分计算、结构化输出和最终结果保存已实现；流式输出、运行事件、取消、超时、重试、错误分类和 `agent_runs` 未实现。 |
| Phase 4：视觉体验 | 部分实现 | 基础主题、Framer Motion 和系统级减少动态效果已实现；3D 翻牌、粒子、罗盘、动画跳过设置和性能基线未实现。 |
| Phase 5：历史、导出与打包 | 部分实现 | 本地历史列表已实现；搜索、筛选、导出、备份恢复、日志轮转、安装包、便携包和 SmartScreen 说明未实现。 |

## 当前运行链路

```text
问题输入
→ 主进程生成并保存固定洗牌结果
→ 自主选择或程序随机选择五张
→ 本地读取牌面、评分并计算 M/V
→ 保存为 pending_interpretation
→ 用户触发一次性模型请求
→ Zod 校验结构化结果
→ 保存 completed 或 failed
```

当前链路没有模型流式事件，也没有独立的工具调用事件或 `runId`。

## 当前持久化模型

当前 SQLite 只有：

- `reading_folders`；
- `readings`。

`readings` 保存问题、模式、状态、洗牌种子、完整牌序、选择索引、揭牌结果、计算、模型输入和最终解读。目标设计中的 `sessions`、`messages`、`agent_runs`、`reading_cards`、`events`、`card_scores` 和 `settings` 尚未迁移为独立表。

## 当前桌面 API

Preload 当前暴露以下扁平接口：

```ts
bootstrap()
createFolder(name)
renameFolder(input)
saveSettings(input)
createReading(input)
confirmReading(input)
interpret(id)
history()
```

架构文档中的 `sessions/readings/settings/events` 分组接口是目标契约，不是当前接口。

## 文档维护规则

1. 完成路线图任务时，同步更新本页状态和日期。
2. 当前实现与目标设计不一致时，优先在目标文档中明确标注，不静默修改验收目标。
3. IPC、SQLite、卡牌 Schema 或生成资源发生变化时，同一提交必须更新相应契约。
4. 只有满足路线图“完成定义”后，才能把仓库称为完整第一版。


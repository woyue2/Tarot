# 数据来源、版本与本地运维

> 内容生成与版本规则已部分落地；数据库迁移、备份恢复、日志轮转、搜索索引和导出章节描述的是完整第一版目标，当前尚未全部实现。实际状态见 [当前实现状态](00-implementation-status.md)。

## 1. Source of Truth

| 数据 | 唯一来源 | 运行时用途 |
|---|---|---|
| 正逆位评分 | `data/calculate-tarot-momentum-value/references/card-scores.csv` | 生成 156 条固定评分 |
| 人类可读评分 | `known-scores.md` | 校对与审阅，不作为程序输入 |
| 计算规则 | `data/塔罗牌动量价值计算模型.md` 与技能中的 `references/model.md` | 公式说明与版本依据 |
| 计算实现原型 | `scripts/tarot_model.py` | 与 TypeScript 实现做一致性测试 |
| 正式视觉描述 | `大阿尔卡那.md`、`权杖.md`、`圣杯.md`、`宝剑.md`、`星币.md` | 生成卡牌视觉字段 |
| 原始生成结果 | `*_结果.txt` | 仅作校对证据，不进入运行时 |
| 多模态模板 | `00_多模态生成prompt模板.md` | 内容生产记录，不进入运行时 |
| 原始牌图 | `data/图片/*.webp` | 构建时复制为稳定资源名 |
| 解牌方法论 | `data/解牌方法论深度解析.txt` | 生成版本化方法论摘要 |

任何生成脚本都必须从上述来源读取，禁止反向修改原始资料。

## 2. 稳定卡牌身份

应用使用以下 ID：

```text
major-00 … major-21
wands-01 … wands-14
cups-01 … cups-14
swords-01 … swords-14
pentacles-01 … pentacles-14
```

CSV 中的 `card_zh` 作为首版规范中文名：

- `皇后`，别名 `女皇`；
- `隐者`，别名 `隐士`；
- `侍从`，别名 `侍者`；
- `王后`，别名 `女王`；
- `愚人`，别名 `愚者`。

UI 可以根据产品文案调整显示别名，但数据库关系、评分查找和资源路径始终使用 `card_id`。

## 3. 构建期生成链路

```text
card-scores.csv
正式视觉描述 .md
原始图片 .webp
解牌方法论 .txt
        ↓
validate-content
        ↓
generate-card-data
        ↓
resources/cards.json
resources/cards/{card_id}.webp
resources/methodology.json
resources/content-manifest.json
```

`cards.json` 至少包含：

```ts
interface GeneratedTarotCard {
  id: string;
  name: string;
  aliases: string[];
  arcana: "major" | "minor";
  suit?: "wands" | "cups" | "swords" | "pentacles";
  rank: number;
  image: string;
  visual: TarotVisual;
  scores: {
    upright: FixedScore;
    reversed: FixedScore;
  };
}
```

生成校验必须检查：

- 恰好 78 个唯一 ID；
- 恰好 22 张大牌和每个花色 14 张小牌；
- 每张牌都有正位与逆位评分；
- 每张牌都能找到原图和正式视觉描述；
- 资源输出名只使用稳定 ASCII ID；
- 所有别名只映射到一个 ID；
- 输出顺序确定，相同输入产生字节稳定的 JSON；
- `content-manifest.json` 记录源文件摘要和生成版本。

## 4. 版本规则

每次完成的解读保存：

```text
content_version
score_table_version
formula_version
methodology_version
prompt_version
model
```

还要保存两个不可变快照：

- `input_snapshot_json`：最终问题、五张牌、方向、牌位、视觉摘要、评分和 basis；
- `calculation_snapshot_json`：`S/D/N/x/M/V`、标签和公式版本。

旧记录默认读取创建时快照。内容、评分或公式升级不得静默重写旧记录。

如果未来提供重新计算：

1. 读取旧抽牌事实；
2. 使用指定新版本生成派生结果；
3. 建立 `derived_from_reading_id`；
4. 保留旧结果；
5. UI 明确并列显示版本差异。

## 5. TypeScript 与 Python 一致性

Python 原型使用 `round_half_away`，TypeScript 必须实现相同规则：

```ts
export function roundHalfAway(value: number): number {
  return Math.sign(value) * Math.floor(Math.abs(value) + 0.5);
}
```

测试固定覆盖：

```text
0.5 → 1
-0.5 → -1
1.5 → 2
-1.5 → -2
2.49 → 2
-2.49 → -2
```

除现有事业、财运案例外，还应自动遍历 156 条评分，对比 Python 导出结果与 TypeScript 结果。

## 6. 模型上下文预算

最终解读只发送：

- 用户最终问题；
- 五张牌的必要视觉摘要；
- 五张固定评分及 basis；
- `M/V` 结果；
- 精简且版本化的方法论；
- 输出 Schema。

不发送完整牌库、完整方法论原文、未抽中的牌、完整历史会话或洗牌种子。方法论摘要应稳定，只有评测证明需要时才扩充，避免无界累积上下文。

## 7. SQLite 备份与恢复

默认策略：

- 数据库使用 WAL 模式；
- 每次数据库迁移前创建在线备份；
- 距上次自动备份超过 24 小时时，在应用空闲期创建一次；
- 默认保留最近 7 个自动备份；
- 手动备份不受自动清理影响；
- 备份清单记录数据库 schema 版本、应用版本、时间和校验摘要；
- 恢复前先对当前数据库再做一次安全备份；
- 恢复时运行 SQLite integrity check 和外键检查；
- 恢复失败不得覆盖当前数据库。

本项目只供个人使用，备份默认不额外加密；如果备份移动到同步盘或外部设备，应由用户选择加密导出。

## 8. 日志与事件保留

应用日志：

- 级别为 `error`、`warn`、`info`、开发环境 `debug`；
- 永不记录 API Key、授权头和完整模型请求；
- 单文件达到 5 MB 后轮转；
- 默认保留 5 个日志文件；
- 设置页提供“打开日志目录”和“复制脱敏诊断信息”。

Runtime 事件：

- 永久保存用户消息、洗牌确认、工具调用、工具结果摘要、最终解释、失败与取消；
- 流式 token/delta 不逐条持久化；
- 运行中按批次保存临时 checkpoint；
- 成功完成后压缩或删除冗余 checkpoint；
- 清理操作不得删除完成解读的事实快照。

## 9. 历史搜索与索引

第一版搜索：

- 会话标题；
- 原始问题和最终问题；
- 五张牌的规范名与别名。

为 `sessions.updated_at`、`readings.status`、`readings.created_at`、`reading_cards.card_id` 建普通索引。个人使用阶段不启用 FTS5，也不搜索全部 AI 正文；真实需求出现后再通过数据库迁移增加。

## 10. 导出

第一版支持 Markdown 导出：

- 问题；
- 五张牌与正逆位；
- 标题、逐牌解释、故事线和建议；
- 创建时间与版本；
- 可选附录：评分、basis、`M/V` 与公式说明。

图片长图导出属于后续增强。导出永不包含 API Key、内部日志、完整牌堆或未抽中的牌。

## 11. 依赖与迁移

- 提交 `pnpm-lock.yaml`；
- CI 与本地使用相同的包管理器主版本；
- 依赖升级分批进行，不把 Electron、React、Astryx、Three.js 同时跨主版本升级；
- 每个 SQLite schema 变更都有单向迁移和迁移前备份；
- 已应用迁移不可修改，只能新增后续迁移；
- 启动时数据库版本高于应用支持版本则拒绝写入并提示升级应用。

## 12. 性能与资源策略

当前 79 张 WebP（含牌背）原始资源总量约 2.54 MB，磁盘体积不是主要风险；主要风险是一次性解码所有正面图片和持续运行粒子效果。

运行策略：

- 暗牌选择阶段只加载同一张牌背资源；
- 确认后只预加载被选中的五张正面；
- 历史列表使用受控尺寸缩略图或延迟加载；
- Three.js 场景在窗口失焦时暂停或降帧；
- 流式输出只保留当前字符串缓冲和批量 checkpoint，不保留每个 token 对象；
- 事件查询始终按 `reading_id/run_id/sequence` 使用索引；
- 性能验收使用固定基线设备与数据集，记录启动时间、帧率、输入延迟、内存和搜索耗时。

如果真实测量未达到路线图预算，优先降级粒子数量、后处理和背景动画，不牺牲选牌状态正确性或文本可读性。

# Tarot Agent、数据与计算模型

> 本文描述完整第一版的目标 Runtime 和数据模型。当前实现已经完成五张牌输入契约、确定性计算和结构化结果校验，但尚未实现完整工具事件流、`agent_runs` 和目标 SQLite 表；详见 [当前实现状态](00-implementation-status.md)。

## 1. Agent 定位

这是一个边界明确的专用 Agent，而不是通用自主 Agent。

Agent 可以：

- 判断问题是否足够具体；
- 最多追问一次；
- 请求执行塔罗工具；
- 根据工具结果解释五张牌；
- 结合方法论生成故事线与行动建议。

Agent 不可以：

- 替用户更换已经确认的牌；
- 修改程序计算结果；
- 调用 Shell、浏览器或 Computer Use；
- 擅自访问本机其他文件；
- 把塔罗结果描述成确定事实；
- 用负分否定用户整个领域或人生。

## 2. 固定运行步骤

抽牌、读取资料、查分和计算由本地 Runtime 按固定顺序执行，不交给最终解读模型自主决定。最终解读模型只能接收已经确认和校验的数据。

### 2.1 `draw_cards`

输入：

```ts
{
  readingId: string;
  mode: "manual" | "random";
  selectedIndexes?: number[];
}
```

输出五张牌的稳定 ID、顺序和正逆位。自主选牌模式必须基于已经持久化的洗牌结果。

### 2.2 `load_card_context`

只加载本次五张牌相关内容：

- 牌名与别名；
- 牌图路径；
- 视觉描述；
- 关键符号；
- 人物朝向；
- 画面故事；
- 易错点；
- 已知正逆位基础评分。

不把完整 78 张牌资料全部发送给模型。

### 2.3 `lookup_card_scores`

从 `card-scores.csv` 生成的本地评分表读取五张牌的固定正逆位评分。

约束：

- 评分表必须包含 78 张牌和 156 个方向评分；
- 不允许在一次解读中临时生成或修改评分；
- 查不到评分时停止解读并报告数据错误；
- 评分表变更属于内容维护，需要提升 `scoreTableVersion` 并重新生成运行时数据；
- `basis` 与数值一起进入最终解读输入。

### 2.4 `calculate_momentum_value`

确定性执行：

- 序位标准分 `N`；
- 单牌最终值 `x`；
- 当前动量 `M`；
- 当前路径价值 `V`；
- 阈值标签。

公式实现需要版本号：

```ts
const FORMULA_VERSION = "momentum-value-v0.1";
```

TypeScript 必须原样移植 Python 的“绝对值半入”舍入规则，禁止直接使用 `Math.round()` 代替：

```ts
export function roundHalfAway(value: number): number {
  return Math.sign(value) * Math.floor(Math.abs(value) + 0.5);
}
```

### 2.5 `save_reading`

在所有必需结果通过校验后，将解读标记为完成。未完成或取消的草稿仍可保留，但不能出现在“已完成解读”筛选中。

## 3. 最终解读输入契约

最终解读只能在五张牌已经确认、基础评分已经解析、确定性计算已经完成后调用。每次调用使用同一结构：

```ts
interface TarotInterpretationInput {
  readingId: string;
  contentVersion: string;
  question: string;
  spread: {
    id: "five_card_timeline_v1";
    name: "五张时间流";
    positions: ["较远背景", "早期状态", "中间状态", "近期状态", "当前状态"];
  };
  draw: {
    mode: "manual" | "random";
    confirmed: true;
  };
  cards: Array<{
    id: string;
    name: string;
    orientation: "upright" | "reversed";
    position: 1 | 2 | 3 | 4 | 5;
    positionName: string;
    visualDescription: string;
    symbols: string[];
    direction: string;
    score: {
      semantic: number;
      dynamic: number;
      rank: number;
      final: number;
      basis: string;
      scoreTableVersion: string;
    };
  }>;
  calculation: {
    formulaVersion: string;
    momentum: number;
    momentumLabel: string;
    value: number;
    valueLabel: string;
  };
  methodology: {
    version: string;
    style: string;
  };
  promptVersion: string;
  outputLanguage: "zh-CN";
}
```

调用前必须验证：

- `draw.confirmed` 必须为 `true`；
- `cards` 必须恰好包含五张不同的牌；
- 位置必须完整覆盖 `1–5`；
- 牌名、方向和分数必须来自当前已确认记录；
- `M/V` 必须来自本地计算函数；
- 评分表、公式、方法论和提示词版本不能为空；
- 模型不得看到可以触发重新抽牌或修改可信计算的工具。

下面这些数据需要持久化，但不发送给最终解读模型：

- 完整 78 张牌顺序；
- 洗牌种子；
- 未抽中的 73 张牌资料；
- API Key；
- SQLite 内部字段；
- 与本次解读无关的历史会话。

任一固定评分缺失时不得调用最终解读模型。Runtime 应将记录标记为数据错误，并提供重新校验本地牌库的操作。

## 4. Agent 输出结构

模型最终输出必须符合：

```ts
interface TarotInterpretation {
  headline: string;
  questionReflection: string;
  cards: Array<{
    cardId: string;
    position: number;
    meaning: string;
    connectionToQuestion: string;
  }>;
  storyline: string;
  momentumInterpretation: string;
  valueInterpretation: string;
  actionAdvice: string[];
  reflectionQuestion: string;
  disclaimer: string;
}
```

UI 可以流式显示过程文本，但只有完整 JSON 通过校验后，才能把解读标记为完成。

输出必须满足：

- `cards` 恰好五项；
- 每项通过 `cardId + position` 关联本地可信牌面；
- `actionAdvice` 包含两至三个可执行但非命令式的建议；
- `momentumInterpretation` 和 `valueInterpretation` 不得发明新数值；
- `disclaimer` 不得为空；
- 不要求模型重复返回牌图、正逆位、评分或公式结果。

## 5. 程序事实与 AI 解释分离

以下字段以本地程序和 SQLite 为唯一事实来源：

```text
牌 ID
牌名
图片
正逆位
选择顺序
洗牌种子
S / D / N / x
M / V
公式版本
```

AI 输出只拥有解释性字段：

```text
标题
情绪映照
单牌含义
与问题的联系
整体故事线
动量解释
价值解释
行动建议
反思问题
声明
```

前端展示时合并两类数据，但不能用 AI 返回文字覆盖程序事实。即使模型在文字中写错牌名或数值，本地记录仍保持不变，并可在输出校验或质量检查中标记异常。

历史记录必须同时保存：

- 不可变的抽牌与计算快照；
- 最终结构化解释；
- 模型、提示词、方法论和公式版本。

这样重试 AI、升级模型或重新生成解读时，可以复用同一组牌和同一组计算结果。

## 6. 解牌提示词原则

提示词保持精简且稳定：

```text
角色：基于给定资料进行生活化、共情式塔罗解读。

目标：解释用户已经确认的五张牌，区分单牌、故事线、当前动量、路径价值和行动建议。

依据：只能使用用户问题、五张牌资料、评分结果、动量价值结果和提供的方法论。

约束：
- 不替换牌面；
- 不修改数值；
- 不做确定性预言；
- 不把局部负价值扩大为整个人生结论；
- 医疗、法律、投资和安全问题只提供象征性反思；
- 给出可执行但非命令式的建议。

输出：只返回符合 TarotInterpretation 结构的解释字段，不重复或改写程序事实。
```

## 7. 卡牌主数据

应用使用统一的 `cards.json`：

```ts
interface TarotCard {
  id: string;
  name: string;
  nameEn: string;
  aliases: string[];
  arcana: "major" | "minor";
  suit?: "wands" | "cups" | "swords" | "pentacles";
  rank: number;
  image: string;
  visual: {
    sourceHeading: string;
    direction: string;
    posture: string;
    colors: string;
    lighting: string;
    symbols: Array<{ name: string; meaning: string }>;
    story: string;
    pitfalls: string;
  };
  scores: {
    upright: FixedScore;
    reversed: FixedScore;
  };
}
```

稳定 ID 规范：

```text
major-00 … major-21
wands-01 … wands-14
cups-01 … cups-14
swords-01 … swords-14
pentacles-01 … pentacles-14
```

ID 是数据库外键和运行时身份，永不使用中文牌名或图片文件名充当 ID。

统一 ID 后通过 `aliases` 兼容：

- 愚人／愚者；
- 女皇／皇后；
- 隐士／隐者；
- 侍者／侍从；
- 女王／王后。

## 8. 洗牌与选择数据

```ts
interface ReadingDraft {
  id: string;
  question: string;
  mode: "manual" | "random";
  status:
    | "question"
    | "selecting"
    | "selected"
    | "confirmed"
    | "revealing"
    | "pending_interpretation"
    | "interpreting"
    | "completed"
    | "cancelled"
    | "failed";
  shuffleSeed: string;
  deck: Array<{
    cardId: string;
    orientation: "upright" | "reversed";
  }>;
  selectedIndexes: number[];
  createdAt: string;
}
```

状态转换：

```text
question
→ selecting
→ selected
→ confirmed
→ revealing
→ interpreting
→ completed
```

联网正常时，`revealing` 可以直接进入 `interpreting`；断网、模型未配置或用户选择稍后解读时进入：

```text
revealing → pending_interpretation
pending_interpretation → interpreting
interpreting → completed
```

失败与重试：

```text
interpreting → failed
failed → interpreting
failed → pending_interpretation
failed → cancelled
```

失败重试复用同一 `readingId`、牌面快照和计算快照，只创建新的 `runId`。错误记录必须区分网络、认证、限流、超时、取消、输出校验和本地数据错误。

可逆操作只发生在确认前：

```text
selecting ↔ selected
selecting/selected → cancelled
selecting/selected → reshuffle → selecting
```

`confirmed` 之后不得回到 `selecting`。

## 9. SQLite 表

本节是完整第一版的目标 schema，不是当前数据库快照。当前实现只有 `reading_folders` 与 `readings`，并把牌序、揭牌、计算、模型输入和最终结果保存为 JSON 列。迁移到以下规范前必须增加 schema 版本、迁移前备份和旧数据兼容测试。

### `sessions`

```text
id, title, created_at, updated_at, archived_at
```

### `messages`

```text
id, session_id, role, content, created_at
```

### `readings`

```text
id, session_id, original_question, resolved_question, draw_mode, status,
shuffle_seed, deck_json, selected_indexes_json,
formula_version, model, prompt_version,
score_table_version, methodology_version,
input_snapshot_json, calculation_snapshot_json,
interpretation_json, last_error_code, last_error_message,
created_at, completed_at
```

### `agent_runs`

```text
id, reading_id, attempt, status, model,
input_hash, started_at, completed_at,
error_code, error_message
```

一次重试新增一个 `agent_runs` 记录，不新增 `readings`。`input_hash` 用于确认重试没有更换牌面或计算快照。

### `reading_cards`

```text
id, reading_id, card_id, position, deck_index, orientation,
semantic_score, dynamic_score, rank_score, final_score,
score_basis, score_table_version
```

### `events`

```text
id, session_id, reading_id, run_id, sequence,
event_type, payload_json, created_at
```

事件类型包括：

```text
user_message
shuffle_created
selection_changed
selection_confirmed
card_revealed
tool_call
tool_result
assistant_checkpoint
interpretation_completed
run_cancelled
run_failed
```

模型流式 delta 只用于内存中的实时 UI，不逐 token 永久写入 SQLite。运行中可以按时间或字符阈值批量写入 `assistant_checkpoint`；成功后保存最终结构化结果，并清理不再需要的中间检查点。

### `card_scores`

```text
card_id, orientation, semantic_score, dynamic_score,
rank_score, final_score, basis, version, updated_at
```

### `settings`

只保存非敏感设置。API Key 使用单独加密存储。

表结构、索引、备份和迁移策略详见 [数据来源、版本与本地运维](06-data-operations.md)。

## 10. 计算模型当前约定

第一版保留 `V0.1` 公式，但界面名称使用：

- `M`：当前动量或末端动量；
- `V`：当前路径价值。

原因是现有动量公式展开后主要表示第五张相对前四张整体水平的变化，不能完整证明中间趋势。

当前 `card-scores.csv` 已包含 78 张牌、156 个正逆位评分，并由 `pnpm generate:content` 的生成校验检查。第一版直接使用完整固定表，不在解读现场临时评分。

评分表仍属于人为设计的符号模型，不代表统计概率。修改 `S/D/basis` 时必须：

1. 修改 `card-scores.csv`；
2. 提升 `scoreTableVersion`；
3. 重新生成 `known-scores.md` 与运行时卡牌数据；
4. 运行完整性、分布与代表案例测试；
5. 保留旧解读中的评分与计算快照。

旧解读默认展示创建时的版本和快照，不随新评分表或新公式自动重算。未来若提供“用新版本重新计算”，必须生成派生记录并保留原结果。

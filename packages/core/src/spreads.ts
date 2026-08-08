export type SpreadCategory = "基础" | "关系" | "决策" | "成长" | "运势" | "综合";
export type SpreadLayoutType = "single" | "row" | "diamond" | "cross" | "v" | "pentagram" | "hexagram" | "circle" | "columns" | "z" | "grid";
export type SpreadRelationType = "compare" | "sequence" | "cause" | "influence" | "contrast" | "synthesize";

export interface SpreadPosition {
  id: string;
  index: number;
  name: string;
  description: string;
  groupId?: string;
  isKey?: boolean;
  promptHint?: string;
  placement: { x: number; y: number; rotation?: number; zIndex?: number; orientation?: "vertical" | "horizontal" };
}

export interface SpreadReadingGuide {
  overviewInstruction: string;
  stages: readonly { id: string; name: string; positionIds: readonly string[]; instruction: string }[];
  relations: readonly { type: SpreadRelationType; positionIds: readonly string[]; instruction: string }[];
  focus: readonly string[];
  synthesis: string;
  guardrails: readonly string[];
}

export interface Spread {
  id: string;
  section: string;
  familyId: string;
  name: string;
  shortName: string;
  description: string;
  category: SpreadCategory;
  difficulty: 1 | 2 | 3 | 4 | 5;
  tags: readonly string[];
  scenarios: readonly string[];
  selectable: boolean;
  deckPolicy: { deck: "full-78" | "minor-56"; allowReversed: boolean; allowClarifier: boolean; maxClarifiers?: number };
  positions: readonly SpreadPosition[];
  layout: {
    type: SpreadLayoutType;
    groups: readonly { id: string; name: string; positionIds: readonly string[] }[];
    connections: readonly { from: string; to: string; type: "sequence" | "compare" | "influence" | "flow" }[];
  };
  reading: SpreadReadingGuide;
  features: { scoring: boolean; energyFlow: boolean; patternAnalysis: boolean };
  /** Backwards-compatible convenience property used by the runtime. */
  supportsScoring: boolean;
}

type PositionInput = readonly [id: string, name: string, description?: string | undefined, groupId?: string | undefined, isKey?: boolean | undefined];
type RelationInput = readonly [type: SpreadRelationType, positionIds: readonly string[], instruction: string];

const SOURCE_TITLES: Readonly<Record<string, string>> = {
  single: "单张牌（日运/即时指引）",
  triple: "圣三角牌阵（3张·时间流）",
  diamond: "钻石牌阵（4张）",
  gypsy_cross: "吉普赛十字牌阵（5张·爱情专用）",
  two_paths: "二选一牌阵（5张·抉择专用）",
  pentacle_week: "五芒星牌阵（5张·周运）",
  pentacle_element: "五芒星牌阵（5张·元素平衡）",
  pentacle_issue: "五芒星牌阵（5张·问题分析）",
  hexagram: "六芒星牌阵（7张·全方位）",
  venus: "维纳斯之爱牌阵（8张·爱情深度）",
  elements: "要素展开法（4张·四元素）",
  celtic_cross: "凯尔特十字牌阵（10张·经典万能）",
  celtic_cross_11: "11张凯尔特十字（含建议牌）",
  year_months_12: "年度运势牌阵（12张·月份版）",
  year: "年度运势牌阵（13张·全年主题＋月份）",
  relationship: "灵魂伴侣/关系牌阵（11张·关系深度分析）",
  red_thread: "红线牌阵（6张·灵魂连接）",
  soulmate_z: "正缘遇见牌阵（Z字形·11张）",
};

function placement(type: SpreadLayoutType, index: number, count: number, spreadId?: string): SpreadPosition["placement"] {
  if (type === "single") return { x: 50, y: 50 };
  if (type === "row") return { x: ((index + 1) * 100) / (count + 1), y: 50 };
  if (type === "circle" || type === "pentagram" || type === "hexagram") {
    if (spreadId === "year" && count === 13) {
      if (index === 0) return { x: 50, y: 50, zIndex: 2 };
      const monthIndex = index - 1;
      const angle = -Math.PI / 2 + (monthIndex * Math.PI * 2) / 12;
      return { x: 50 + Math.cos(angle) * 38, y: 50 + Math.sin(angle) * 38 };
    }
    if (type === "hexagram" && count === 7) {
      const slots = [[50, 8], [82, 66], [18, 66], [50, 92], [18, 34], [82, 34], [50, 50]];
      const slot = slots[index] ?? [50, 50];
      return { x: slot[0]!, y: slot[1]!, ...(index === 6 ? { zIndex: 2 } : {}) };
    }
    if (type === "pentagram") {
      const slots = spreadId === "pentacle_element"
        ? [[50, 10], [80, 30], [80, 70], [20, 70], [20, 30]]
        : [[50, 10], [20, 30], [20, 70], [80, 70], [80, 30]];
      const slot = slots[index] ?? [50, 50];
      return { x: slot[0]!, y: slot[1]! };
    }
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / count;
    return { x: 50 + Math.cos(angle) * 38, y: 50 + Math.sin(angle) * 38 };
  }
  if (type === "cross") {
    if (count === 5) {
      const slots = [[50, 10], [50, 90], [16, 50], [84, 50], [50, 50]];
      const slot = slots[index] ?? [50, 50];
      return { x: slot[0]!, y: slot[1]!, ...(index === 4 ? { zIndex: 2 } : {}) };
    }
    const celticSlots = [
      { x: 38, y: 50, zIndex: 1 },
      { x: 38, y: 50, rotation: 90, zIndex: 2, orientation: "horizontal" as const },
      { x: 38, y: 12 }, { x: 38, y: 88 }, { x: 12, y: 50 }, { x: 64, y: 50 },
      { x: 88, y: 88 }, { x: 88, y: 63 }, { x: 88, y: 37 }, { x: 88, y: 12 },
      { x: 64, y: 88 },
    ];
    return celticSlots[index] ?? { x: 50, y: 50 };
  }
  if (type === "z") {
    const zSlots = [[18, 15], [50, 15], [82, 15], [76, 28], [64, 39], [50, 50], [36, 61], [24, 72], [18, 85], [50, 85], [82, 85]];
    const slot = zSlots[index] ?? [50, 50];
    return { x: slot[0]!, y: slot[1]! };
  }
  if (type === "v") {
    const vSlots = [[50, 82], [30, 50], [70, 50], [18, 18], [82, 18]];
    const slot = vSlots[index] ?? [50, 50];
    return { x: slot[0]!, y: slot[1]! };
  }
  if (type === "diamond") {
    const slots = [[50, 10], [25, 50], [75, 50], [50, 90]];
    const slot = slots[index] ?? [50, 50];
    return { x: slot[0]!, y: slot[1]! };
  }
  if (type === "columns") return { x: index === 0 ? 50 : index % 2 ? 25 : 75, y: index === 0 ? 50 : 12 + Math.ceil(index / 2) * 15 };
  if (spreadId === "venus") {
    // 文档布局：    3
    //          1   2
    //            4
    //          7 5 8
    //            6
    const slots = [[25, 28], [75, 28], [50, 10], [50, 43], [50, 68], [50, 90], [25, 68], [75, 68]];
    const slot = slots[index] ?? [50, 50];
    return { x: slot[0]!, y: slot[1]!, ...(index === 0 ? { zIndex: 2 } : {}) };
  }
  const columns = Math.ceil(Math.sqrt(count));
  return { x: ((index % columns) + 1) * 100 / (columns + 1), y: (Math.floor(index / columns) + 1) * 100 / (Math.ceil(count / columns) + 1) };
}

function makeSpread(input: {
  id: string; section: string; familyId: string; title: string; description: string; category: SpreadCategory;
  difficulty: 1 | 2 | 3 | 4 | 5; tags: string[]; scenarios?: string[]; layout: SpreadLayoutType;
  positions: PositionInput[]; order?: string[]; focus: string[]; synthesis: string; relations?: RelationInput[];
  stages?: SpreadReadingGuide["stages"]; groups?: Spread["layout"]["groups"]; connections?: Spread["layout"]["connections"];
  guardrails?: string[]; deck?: "full-78" | "minor-56"; scoring?: boolean; selectable?: boolean;
}): Spread {
  const title = SOURCE_TITLES[input.id] ?? input.title;
  const spreadPositions = input.positions.map(([id, name, description = name, groupId, isKey], index) => ({
    id, index: index + 1, name, description,
    ...(groupId ? { groupId } : {}), ...(isKey ? { isKey: true } : {}),
    placement: placement(input.layout, index, input.positions.length, input.id),
  }));
  const order = input.order ?? spreadPositions.map((position) => position.id);
  const scoring = input.scoring ?? false;
  return {
    id: input.id, section: input.section, familyId: input.familyId,
    name: input.section ? `${input.section}（${title}）` : title,
    shortName: title, description: input.description, category: input.category,
    difficulty: input.difficulty, tags: input.tags, scenarios: input.scenarios ?? input.tags,
    selectable: input.selectable ?? true,
    deckPolicy: { deck: input.deck ?? "full-78", allowReversed: true, allowClarifier: true, maxClarifiers: 1 },
    positions: spreadPositions,
    layout: { type: input.layout, groups: input.groups ?? [], connections: input.connections ?? [] },
    reading: {
      overviewInstruction: "先鸟瞰整体色调、元素、大阿尔卡那比例、重复符号与人物朝向，再进入逐位解读。",
      stages: input.stages ?? [{ id: "main", name: "主体解读", positionIds: order, instruction: `按 ${order.join(" → ")} 的顺序组织解读。` }],
      relations: (input.relations ?? []).map(([type, positionIds, instruction]) => ({ type, positionIds, instruction })),
      focus: input.focus, synthesis: input.synthesis,
      guardrails: input.guardrails ?? ["结果表示当前趋势，不是注定结局。", "建议落到问卜者可以控制的行动。"],
    },
    features: { scoring, energyFlow: true, patternAnalysis: true }, supportsScoring: scoring,
  };
}

const triple = (input: Omit<Parameters<typeof makeSpread>[0], "familyId" | "category" | "difficulty" | "layout" | "tags">): Spread =>
  makeSpread({
    ...input,
    title: input.section.startsWith("1.3.") ? `三张牌变体·${input.title}（3张）` : input.title,
    familyId: "triple", category: "基础", difficulty: 1, layout: "row", tags: ["三张牌"],
  });

export const SPREADS: readonly Spread[] = [
  makeSpread({
    id: "five_card_timeline_v1", section: "", familyId: "default", title: "五张时间流", description: "现有默认抽卡方式，保留动量与价值评分。",
    category: "基础", difficulty: 1, tags: ["默认", "时间流"], layout: "row", selectable: false, scoring: true,
    positions: [["far-background", "较远背景"], ["early-state", "早期状态"], ["middle-state", "中间状态"], ["recent-state", "近期状态"], ["current-state", "当前状态"]],
    focus: ["观察五个阶段的动量变化。"], synthesis: "将五张牌串成从较远背景走向当下的连续叙事。",
  }),
  makeSpread({
    id: "single", section: "1.1", familyId: "single", title: "单张牌（日运/即时指引）", description: "日运、即时指引与快速回答。",
    category: "基础", difficulty: 1, tags: ["日运", "即时指引"], layout: "single",
    positions: [["message", "核心讯息", "此刻最需要看见的一件事", undefined, true]],
    focus: ["使用情绪词、符号词、信息词三个角度。", "关注第一直觉、身体反应、主色调、人物朝向与关键符号。"],
    synthesis: "用一句核心信息回应问题，再给一个立即可执行的提醒。",
  }),
  triple({
    id: "triple", section: "1.2", title: "圣三角牌阵（3张·时间流）", description: "过去、现在与未来的时间流。",
    positions: [["past", "过去"], ["present", "现在", "当前状况", undefined, true], ["future", "未来"]],
    focus: ["中间牌是核心，左右构成来龙去脉。", "观察人物朝向与元素流动。"], synthesis: "串成开端、发展、未来趋势的故事弧线。",
  }),
  triple({ id: "triple_problem_solving", section: "1.3.1", title: "问题本质／原因／解决方案", description: "理解现状类三张牌预设。", positions: [["essence", "问题本质"], ["cause", "原因"], ["solution", "解决方案"]], focus: ["解决方案必须回应原因。"], synthesis: "从本质和成因推导可执行方案。", relations: [["cause", ["cause", "solution"], "说明解决方案如何处理原因。"]] }),
  triple({ id: "triple_obstacle", section: "1.3.2", title: "现状／障碍／建议", description: "理解现状类三张牌预设。", positions: [["situation", "现状"], ["obstacle", "障碍", "当前卡点", undefined, true], ["advice", "建议"]], focus: ["把障碍翻译成可处理的卡点。"], synthesis: "给出直接回应障碍的具体建议。", relations: [["cause", ["obstacle", "advice"], "建议必须直接回应障碍。"]] }),
  triple({ id: "triple_action", section: "1.3.3", title: "情境／行动／结果", description: "理解现状类三张牌预设。", positions: [["context", "情境"], ["action", "行动"], ["result", "结果"]], focus: ["结果是采取该行动后的当前趋势。"], synthesis: "解释情境如何经由行动发展为结果。", relations: [["sequence", ["context", "action", "result"], "形成完整因果链。"]] }),
  triple({ id: "triple_control", section: "1.3.4", title: "能改变／不能改变／未意识到", description: "理解现状类三张牌预设。", positions: [["changeable", "能改变的"], ["unchangeable", "不能改变的"], ["unseen", "你可能没意识到的"]], focus: ["明确区分可控和不可控。"], synthesis: "把未意识到的内容转化为觉察和下一步。" }),
  triple({ id: "triple_relationship", section: "1.3.5", title: "你／对方／关系现状", description: "关系类三张牌预设。", positions: [["self", "你"], ["other", "对方"], ["relationship", "关系现状"]], focus: ["比较双方能量和人物视线。", "不把对方牌解释成已证实的心理事实。"], synthesis: "说明双方如何共同构成关系现状。", relations: [["compare", ["self", "other"], "比较双方差异与共鸣。"]] }),
  triple({ id: "triple_relationship_needs", section: "1.3.6", title: "你想要／对方想要／关系走向", description: "关系类三张牌预设。", positions: [["self-wants", "你想要的"], ["other-wants", "对方想要的"], ["direction", "关系走向"]], focus: ["判断需求的共鸣、错位与协商空间。"], synthesis: "说明双方需求如何影响关系走向。", relations: [["compare", ["self-wants", "other-wants"], "比较双方需求。"]] }),
  triple({ id: "triple_relationship_tension", section: "1.3.7", title: "相聚／分离／关注点", description: "关系类三张牌预设。", positions: [["together", "让你们在一起的"], ["apart", "让你们分开的"], ["attention", "需要关注的"]], focus: ["同时承认连接与张力。"], synthesis: "把关注点转化为改善连接、处理张力的方向。", relations: [["contrast", ["together", "apart"], "比较关系中的连接力和分离力。"]] }),
  triple({ id: "triple_decision", section: "1.3.8", title: "选项A／选项B／如何决定", description: "选择决策类三张牌预设。", positions: [["option-a", "选项 A"], ["option-b", "选项 B"], ["decision", "如何做决定"]], focus: ["比较代价、价值与适配条件，不宣判唯一正确选项。"], synthesis: "形成清晰的决策准则。", relations: [["compare", ["option-a", "option-b"], "比较两个选项。"]] }),
  triple({ id: "triple_opportunity", section: "1.3.9", title: "机会／挑战／结果", description: "选择决策类三张牌预设。", positions: [["opportunity", "机会"], ["challenge", "挑战"], ["result", "结果"]], focus: ["结果同时受到机会和挑战制约。"], synthesis: "说明如何利用机会并处理挑战。" }),
  triple({ id: "triple_strengths", section: "1.3.10", title: "优势／劣势／建议", description: "选择决策类三张牌预设。", positions: [["strength", "优势"], ["weakness", "劣势"], ["advice", "建议"]], focus: ["建议应利用优势并补足劣势。"], synthesis: "给出扬长补短的行动方案。", relations: [["contrast", ["strength", "weakness"], "比较优势与劣势。"]] }),
  triple({ id: "triple_body_mind_spirit", section: "1.3.11", title: "身／心／灵", description: "自我认知类三张牌预设。", positions: [["body", "身"], ["mind", "心"], ["spirit", "灵"]], focus: ["识别三个层面的一致、冲突或失衡。"], synthesis: "提出恢复身心灵平衡的建议。" }),
  triple({ id: "triple_consciousness", section: "1.3.12", title: "显意识／潜意识／超意识", description: "自我认知类三张牌预设。", positions: [["conscious", "显意识"], ["subconscious", "潜意识"], ["superconscious", "超意识"]], focus: ["比较显性目标和潜在动力。", "超意识是更高视角而非权威命令。"], synthesis: "整合三个意识层次的讯息。" }),
  triple({ id: "triple_states", section: "1.3.13", title: "物质／精神／情绪状态", description: "自我认知类三张牌预设。", positions: [["material", "物质状态"], ["mental", "精神状态"], ["emotional", "情绪状态"]], focus: ["识别哪个层面对其他层面施压。"], synthesis: "给出跨层面的调整建议。" }),
  triple({ id: "triple_habit", section: "1.3.14", title: "停止／开始／继续", description: "自我认知类三张牌预设。", positions: [["stop", "停止做什么"], ["start", "开始做什么"], ["continue", "继续做什么"]], focus: ["明确区分停止、开始和继续三类行动。"], synthesis: "输出可执行的 stop、start、continue 行动组合。" }),
  makeSpread({ id: "diamond", section: "1.4", familyId: "diamond", title: "钻石牌阵", description: "更细致地分析过去、现在与未来。", category: "综合", difficulty: 2, tags: ["现状", "时间流"], layout: "diamond", positions: [["past", "过去"], ["present-a", "现在（上）", "当前状况的一面", "present"], ["present-b", "现在（下）", "当前状况的另一面", "present"], ["future", "未来"]], order: ["past", "present-a", "present-b", "future"], focus: ["综合两张现在牌的矛盾或互补。"], synthesis: "以两张现在牌为核心串联过去与未来。", relations: [["compare", ["present-a", "present-b"], "比较两个现状面向。"]] }),
  makeSpread({ id: "gypsy_cross", section: "1.5", familyId: "gypsy-cross", title: "吉普赛十字牌阵", description: "爱情关系的快速诊断。", category: "关系", difficulty: 2, tags: ["爱情", "关系"], layout: "cross", positions: [["mindset", "问卜者心态"], ["situation", "当前状况"], ["action", "采取的举措"], ["environment", "环境"], ["future", "关系未来", "两人关系未来的状况", undefined, true]], focus: ["先读四张外围牌，最后读中心未来牌。", "环境牌揭示被忽略的外部因素。"], synthesis: "用中心牌综合外围四张对关系未来的影响。" }),
  makeSpread({ id: "two_paths", section: "1.6", familyId: "decision", title: "二选一牌阵", description: "比较两个选择的过程与结果。", category: "决策", difficulty: 2, tags: ["抉择", "决策"], layout: "v", positions: [["current", "当前状况"], ["a-process", "选择 A 的发展"], ["b-process", "选择 B 的发展"], ["a-result", "选择 A 的结果"], ["b-result", "选择 B 的结果"]], order: ["current", "a-process", "a-result", "b-process", "b-result"], focus: ["过程和结果同样重要。", "比较两边的大/小牌比例、人物活力与能量流。", "若两边都不理想，可以提出第三路径。"], synthesis: "分别形成 A、B 两条完整路径，再给决策依据。", relations: [["sequence", ["a-process", "a-result"], "解释 A 的过程如何通向结果。"], ["sequence", ["b-process", "b-result"], "解释 B 的过程如何通向结果。"], ["compare", ["a-process", "a-result", "b-process", "b-result"], "比较两条路径的成本、成长与结果。"]] }),
  makeSpread({ id: "pentacle_week", section: "2.1.1", familyId: "pentacle", title: "五芒星牌阵·周运", description: "未来五周的连续趋势。", category: "运势", difficulty: 3, tags: ["周运", "时间流"], layout: "pentagram", positions: [["week-1", "本周"], ["week-2", "下周"], ["week-3", "第三周"], ["week-4", "第四周"], ["week-5", "第五周"]], focus: ["解释相邻周之间的过渡。"], synthesis: "形成五周趋势曲线，重点落在近期可行动部分。" }),
  makeSpread({ id: "pentacle_element", section: "2.1.2", familyId: "pentacle", title: "五芒星牌阵·元素", description: "检查灵性、行动、情感、现实与思维的平衡。", category: "成长", difficulty: 3, tags: ["元素", "平衡"], layout: "pentagram", positions: [["spirit", "精神／灵性", "更高指引与核心本质", undefined, true], ["fire", "意志／行动"], ["water", "情感／直觉"], ["earth", "物质／现实"], ["air", "思维／沟通"]], focus: ["灵性牌统领全局。", "判断五个维度的强弱与失衡。"], synthesis: "给出恢复元素平衡的优先级和行动。" }),
  makeSpread({ id: "pentacle_issue", section: "2.1.3", familyId: "pentacle", title: "五芒星牌阵·问题分析", description: "复杂问题的结构化拆解。", category: "综合", difficulty: 3, tags: ["问题分析"], layout: "pentagram", positions: [["current", "现状"], ["obstacle", "障碍", "问题核心或卡点", undefined, true], ["past", "过去"], ["future", "未来"], ["advice", "建议"]], order: ["past", "current", "future", "advice"], focus: ["障碍是改善线索，不是敌人。"], synthesis: "按成因、现在、未来、改善点组织故事，并把障碍贯穿其中。", relations: [["cause", ["past", "current", "future"], "形成问题发展链。"], ["influence", ["obstacle", "advice"], "建议应处理障碍。"]] }),
  makeSpread({ id: "hexagram", section: "2.2", familyId: "hexagram", title: "六芒星牌阵", description: "同时观察时间流、关系和对策。", category: "综合", difficulty: 3, tags: ["通用", "矛盾统合"], layout: "hexagram", positions: [["past", "过去", "问题背景", "timeline"], ["present", "现在", "当前状况", "timeline"], ["future", "未来", "近期发展", "timeline"], ["strategy", "对策／建议", "行动指引", "people"], ["environment", "对方／环境", "他人想法和周遭状况", "people"], ["self", "自己／心态", "问卜者本心与态度", "people"], ["result", "最终结果", "整体结论", undefined, true]], order: ["past", "present", "future", "environment", "self", "strategy", "result"], focus: ["上三角看时间流，下三角看人与对策。", "中心结果必须结合前六张。"], synthesis: "统合时间、双方认知和行动对策，解释结果如何形成。", relations: [["compare", ["environment", "self"], "比较自己与环境或对方的认知差距。"], ["influence", ["strategy", "result"], "对策是问题与结果之间的桥梁。"]] }),
  makeSpread({ id: "venus", section: "2.3", familyId: "venus", title: "维纳斯之爱牌阵", description: "爱情关系的深度分析。", category: "关系", difficulty: 3, tags: ["爱情", "深度关系"], layout: "grid", positions: [["self-thought", "自己的想法", "你对关系的看法、感受与期望", "thoughts"], ["other-thought", "对方的想法", "对方对关系的可能看法、感受与期望", "thoughts"], ["impact-self", "对自己的影响", "关系对你的影响", "impact"], ["impact-other", "对对方的影响", "关系对对方的可能影响", "impact"], ["obstacle", "双方的障碍", "关系中的问题或挑战", undefined, true], ["result", "最终结果", "按当前趋势发展的结果"], ["future-self", "将来自己的心情", "未来发展中你的情绪变化", "future-feelings"], ["future-other", "将来对方的心情", "未来发展中对方可能的情绪变化", "future-feelings"]], order: ["self-thought", "other-thought", "impact-self", "impact-other", "future-self", "future-other", "obstacle", "result"], focus: ["障碍牌是关键因果点。", "结果是当前趋势而非定数。"], synthesis: "整合双方想法、影响、未来心情、障碍与结果，形成关系发展故事。", relations: [["compare", ["self-thought", "other-thought"], "比较双方想法。"], ["compare", ["impact-self", "impact-other"], "比较关系对双方的影响。"], ["compare", ["future-self", "future-other"], "比较未来情绪走向。"], ["influence", ["obstacle", "result"], "说明障碍如何塑造结果。"]], deck: "full-78", guardrails: ["传统版本可只用 56 张小阿尔卡那；当前版本使用全 78 张。", "不要把对方位置解释为已经证实的心理事实。", "结果表示当前趋势，不是注定结局。"] }),
  makeSpread({ id: "elements", section: "2.4", familyId: "elements", title: "要素展开法", description: "从行动、沟通、情感、现实四维度形成建议。", category: "成长", difficulty: 2, tags: ["行动方案", "四元素"], layout: "grid", positions: [["fire", "火：行动建议"], ["air", "风：沟通建议"], ["water", "水：情感建议"], ["earth", "土：物质建议"]], focus: ["分别回答做什么、说什么、持何种情绪态度、如何处理现实资源。"], synthesis: "把四个维度整合成具体改善计划。" }),
  makeSpread({ id: "celtic_cross", section: "3.1", familyId: "celtic-cross", title: "凯尔特十字牌阵", description: "复杂问题的全景分析。", category: "综合", difficulty: 5, tags: ["复杂问题", "全景"], layout: "cross", positions: [["current", "现状／核心", "问题的当前核心", "cross", true], ["challenge", "障碍／助力", "面临的矛盾、阻碍或帮助", "cross"], ["ideal", "理想／目标", "显性期望", "cross"], ["root", "基础／根源", "深层原因", "cross"], ["past", "遥远过去", "历史成因", "cross"], ["future", "不久的将来", "未来两三个月趋势", "cross"], ["self", "自我状态", "求问者的现状与立场", "column"], ["environment", "周遭环境", "外部环境影响", "column"], ["hope-fear", "愿望／恐惧", "希望与担忧的一体两面", "column"], ["result", "最终结果", "当前趋势的终点", "column"]], order: ["current", "challenge", "ideal", "root", "past", "future", "self", "environment", "hope-fear", "result"], focus: ["位置 1 是中心。", "位置 2 可能是阻碍也可能是助力。", "愿望与恐惧必须作一体两面的解读。"], synthesis: "先读左侧十字了解问题，再读右侧柱形了解人和环境，最后形成完整故事。", relations: [["compare", ["ideal", "root"], "比较表意识目标与深层根源。"], ["sequence", ["past", "current", "future"], "串联时间线。"], ["synthesize", ["current", "result"], "结果围绕核心问题形成。"]] }),
  makeSpread({ id: "celtic_cross_11", section: "3.2", familyId: "celtic-cross", title: "11张凯尔特十字", description: "标准凯尔特十字加建议牌。", category: "综合", difficulty: 5, tags: ["复杂问题", "行动建议"], layout: "cross", positions: [["current", "现状／核心"], ["challenge", "障碍／助力"], ["ideal", "理想／目标"], ["root", "基础／根源"], ["past", "遥远过去"], ["future", "不久的将来"], ["self", "自我状态"], ["environment", "周遭环境"], ["hope-fear", "愿望／恐惧"], ["result", "最终结果"], ["advice", "建议／指引", "具体行动指引", undefined, true]], focus: ["前十张按标准凯尔特十字解读。", "第十一张是落地部分。"], synthesis: "形成标准十字完整故事，再结合结果牌解释建议牌。", relations: [["influence", ["result", "advice"], "建议必须结合当前趋势结果。"]] }),
  makeSpread({ id: "year_months_12", section: "3.3.1", familyId: "year", title: "年度运势·12月月份牌阵", description: "十二个月份的年度趋势。", category: "运势", difficulty: 4, tags: ["年度", "月份"], layout: "circle", positions: [["jan", "一月"], ["feb", "二月"], ["mar", "三月"], ["apr", "四月"], ["may", "五月"], ["jun", "六月"], ["jul", "七月"], ["aug", "八月"], ["sep", "九月"], ["oct", "十月"], ["nov", "十一月"], ["dec", "十二月"]], focus: ["观察月份过渡、季节性元素和大牌集中的转折月。", "重点聚焦接下来两三个月。"], synthesis: "形成全年趋势曲线，并指出关键转折月份。" }),
  makeSpread({ id: "year", section: "3.3.2", familyId: "year", title: "年度运势·全年主题＋月份", description: "年度主题加十二个月趋势。", category: "运势", difficulty: 4, tags: ["年度", "主题", "月份"], layout: "circle", positions: [["theme", "年度主题", "全年的核心能量与总课题", undefined, true], ["jan", "一月"], ["feb", "二月"], ["mar", "三月"], ["apr", "四月"], ["may", "五月"], ["jun", "六月"], ["jul", "七月"], ["aug", "八月"], ["sep", "九月"], ["oct", "十月"], ["nov", "十一月"], ["dec", "十二月"]], focus: ["年度主题是每个月的解释滤镜。", "观察月份过渡、重要转折和季节元素变化。", "重点聚焦接下来两三个月。"], synthesis: "先解释年度主题，再说明各月如何呼应或挑战主题。", relations: [["influence", ["theme", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], "每个月都在年度主题的滤镜下解释。"]] }),
  makeSpread({ id: "relationship", section: "3.4.1", familyId: "relationship", title: "关系深度分析牌阵", description: "对称比较双方完整状态与关系走向。", category: "关系", difficulty: 4, tags: ["关系", "深度分析"], layout: "columns", positions: [["current", "关系现状", "当前关系整体状态", undefined, true], ["self-attitude", "你的态度", "你对关系的看法", "self"], ["other-attitude", "对方态度", "对方可能的关系姿态", "other"], ["self-needs", "你的需求", "你在关系中的需求", "self"], ["other-needs", "对方需求", "对方可能的需求", "other"], ["self-feelings", "你的感受", "你对对方的真实感受", "self"], ["other-feelings", "对方感受", "对方可能的感受", "other"], ["self-external", "你的外部", "你这边的环境影响", "self"], ["other-external", "对方外部", "对方那边的环境影响", "other"], ["self-future", "你的未来", "你在关系中的未来走向", "self"], ["other-future", "对方未来", "对方在关系中的可能走向", "other"]], order: ["current", "self-attitude", "other-attitude", "self-needs", "other-needs", "self-feelings", "other-feelings", "self-external", "other-external", "self-future", "other-future"], focus: ["左右对称比较，找出差异与共鸣。", "需求是否匹配是关系能否持续的关键线索。"], synthesis: "从关系现状出发，逐层比较态度、需求、感受、外部因素和未来是否同向。", relations: [["compare", ["self-attitude", "other-attitude"], "比较双方态度。"], ["compare", ["self-needs", "other-needs"], "比较双方需求。"], ["compare", ["self-feelings", "other-feelings"], "比较双方感受。"], ["compare", ["self-external", "other-external"], "比较外部影响。"], ["compare", ["self-future", "other-future"], "比较未来走向。"]], guardrails: ["对方位置表示牌阵中的可能互动模式，不是已证实的心理事实。", "结果表示当前趋势，不是注定结局。"] }),
  makeSpread({ id: "red_thread", section: "3.4.2", familyId: "relationship", title: "红线牌阵", description: "探索灵魂层面的关系连接。", category: "关系", difficulty: 4, tags: ["灵魂连接", "关系功课"], layout: "columns", positions: [["self-soul", "你的灵魂"], ["other-soul", "对方灵魂"], ["self-lesson", "你的功课"], ["other-lesson", "对方功课"], ["bond", "连接之线", "连接双方的核心纽带", undefined, true], ["mission", "关系使命"]], focus: ["灵魂连接不一定以恋人关系呈现。", "理解连接意义比追求结果更重要。"], synthesis: "整合双方特质、各自功课、连接纽带与关系意义。", relations: [["compare", ["self-soul", "other-soul"], "比较双方灵魂特质。"], ["compare", ["self-lesson", "other-lesson"], "比较双方各自要承担的功课。"]], guardrails: ["不要把灵魂伴侣作为关系结果保证。", "使用象征和自我反思语言，不宣称客观灵魂事实。"] }),
  makeSpread({ id: "soulmate_z", section: "3.5", familyId: "soulmate-z", title: "正缘遇见牌阵", description: "沿 Z 字转折线探索相遇前、缘分发展与相遇后。", category: "关系", difficulty: 4, tags: ["正缘", "关系发展"], layout: "z", positions: [["current", "你的现状", "目前感情和生活状态", "before"], ["mindset", "你的心境", "对感情的期待、恐惧与矛盾", "before"], ["readiness", "你的准备度", "是否准备好迎接适合的缘分", "before", true], ["traits", "正缘的特质", "适合你的缘分类型的核心特质", "meeting"], ["occasion", "相遇的契机", "可能相遇的方式、场景或媒介", "meeting"], ["spark", "初识的火花", "初次互动的能量", "meeting", true], ["development", "关系的发展", "从相识到深入的过程", "meeting"], ["lesson", "共同的课题", "关系需要面对的考验", "meeting", true], ["stability", "关系的稳定度", "长远发展的基础", "after"], ["growth", "双方的成长", "关系带来的成长", "after"], ["destination", "最终的归宿", "当前趋势下的关系走向", "after"]], focus: ["上排、斜线、下排各形成一句故事。", "比较遇见前后的色调和人生方向。", "沿斜线观察人物朝向和能量流动。", "准备度、初识火花、共同课题是关键位置。"], synthesis: "顺着 Z 字笔画串成遇见前、相遇发展、遇见后的完整故事。", relations: [["compare", ["current", "mindset"], "比较外在现状与内在心境。"], ["sequence", ["traits", "occasion", "spark", "development", "lesson"], "形成缘分流动线。"], ["contrast", ["current", "mindset", "readiness", "stability", "growth", "destination"], "比较遇见前后的变化。"]], guardrails: ["正缘不是特定某个人，而是适合问卜者的缘分类型。", "不要执着于外貌或断言具体身份和时间。", "最终归宿是趋势，不是注定结局。"] }),
];

export const SELECTABLE_SPREADS: readonly Spread[] = SPREADS.filter((spread) => spread.selectable);

export function getSpreadById(id: string): Spread | undefined {
  return SPREADS.find((spread) => spread.id === id);
}

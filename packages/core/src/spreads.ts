export interface SpreadPosition {
  index: number;
  name: string;
  hint?: string;
}

/**
 * A spread is configuration, not a separate reading flow.  The renderer may
 * choose to honour `layout`; drawing and interpretation always use positions.
 */
export interface Spread {
  id: string;
  name: string;
  description: string;
  positions: readonly SpreadPosition[];
  supportsScoring: boolean;
  layout: "row" | "grid" | "cross" | "z" | "circle";
}

const positions = (...names: string[]): readonly SpreadPosition[] =>
  names.map((name, index) => ({ index: index + 1, name }));

export const SPREADS: readonly Spread[] = [
  {
    id: "five_card_timeline_v1",
    name: "五张时间流",
    description: "从较远背景一路读到当下；这是现有动量与价值评分的默认牌阵。",
    positions: positions("较远背景", "早期状态", "中间状态", "近期状态", "当前状态"),
    supportsScoring: true,
    layout: "row",
  },
  {
    id: "single",
    name: "单张牌",
    description: "快速看见此刻最值得关注的核心讯息。",
    positions: positions("核心讯息"),
    supportsScoring: false,
    layout: "row",
  },
  {
    id: "triple",
    name: "圣三角",
    description: "过去、现在与未来的连续故事线。",
    positions: positions("过去", "现在", "未来"),
    supportsScoring: false,
    layout: "row",
  },
  {
    id: "triple_problem_solving",
    name: "三张牌：问题拆解",
    description: "适合厘清问题本质、成因与可行的解决方向。",
    positions: positions("问题本质", "原因", "解决方案"),
    supportsScoring: false,
    layout: "row",
  },
  {
    id: "triple_relationship",
    name: "三张牌：关系",
    description: "从双方与关系本身三个角度看见互动。",
    positions: positions("你", "对方", "关系现状"),
    supportsScoring: false,
    layout: "row",
  },
  {
    id: "triple_decision",
    name: "三张牌：决策",
    description: "比较两个选项，并找到做决定的依据。",
    positions: positions("选项 A", "选项 B", "如何做决定"),
    supportsScoring: false,
    layout: "row",
  },
  {
    id: "diamond",
    name: "钻石牌阵",
    description: "从过去、现状的两个面向与未来分析复杂处境。",
    positions: positions("过去", "现在：上层", "现在：下层", "未来"),
    supportsScoring: false,
    layout: "grid",
  },
  {
    id: "elements",
    name: "要素展开",
    description: "用行动、沟通、情感和现实四个维度形成建议。",
    positions: positions("火：行动建议", "风：沟通建议", "水：情感建议", "土：现实建议"),
    supportsScoring: false,
    layout: "grid",
  },
  {
    id: "gypsy_cross",
    name: "吉普赛十字",
    description: "适合爱情关系的快速诊断。",
    positions: positions("问卜者心态", "当前状况", "采取的举措", "环境", "关系未来"),
    supportsScoring: false,
    layout: "cross",
  },
  {
    id: "two_paths",
    name: "二选一",
    description: "同时看见两条路径的过程与结果。",
    positions: positions("当前状况", "选择 A 的发展", "选择 B 的发展", "选择 A 的结果", "选择 B 的结果"),
    supportsScoring: false,
    layout: "grid",
  },
  {
    id: "pentacle_week",
    name: "五芒星：周运",
    description: "依次观察未来五周的趋势。",
    positions: positions("本周", "下周", "第三周", "第四周", "第五周"),
    supportsScoring: false,
    layout: "circle",
  },
  {
    id: "pentacle_element",
    name: "五芒星：元素",
    description: "检查灵性、行动、情感、现实与思维的平衡。",
    positions: positions("火：灵性", "火：意志与行动", "水：情感与直觉", "土：物质与现实", "风：思维与沟通"),
    supportsScoring: false,
    layout: "circle",
  },
  {
    id: "pentacle_issue",
    name: "五芒星：问题分析",
    description: "将复杂问题拆成现状、障碍、过去、未来与建议。",
    positions: positions("现状", "障碍", "过去", "未来", "建议"),
    supportsScoring: false,
    layout: "circle",
  },
  {
    id: "hexagram",
    name: "六芒星",
    description: "同时观察时间流、关系和对策的通用牌阵。",
    positions: positions("过去", "现在", "未来", "对策", "环境／对方", "自己心态", "结果"),
    supportsScoring: false,
    layout: "grid",
  },
  {
    id: "venus",
    name: "维纳斯之爱",
    description: "深入理解亲密关系中的想法、影响、障碍和走向。",
    positions: positions("自己的想法", "对方的想法", "对自己的影响", "对对方的影响", "双方障碍", "最终结果", "未来自己的心情", "未来对方的心情"),
    supportsScoring: false,
    layout: "grid",
  },
  {
    id: "celtic_cross",
    name: "凯尔特十字",
    description: "适用于需要全面剖析的复杂问题。",
    positions: positions("现状", "障碍", "理想", "基础", "过去", "将来", "自我", "环境", "愿望与恐惧", "结果"),
    supportsScoring: false,
    layout: "cross",
  },
  {
    id: "celtic_cross_11",
    name: "十一张凯尔特十字",
    description: "在凯尔特十字的全局诊断后加入具体行动建议。",
    positions: positions("现状", "障碍", "理想", "基础", "过去", "将来", "自我", "环境", "愿望与恐惧", "结果", "建议"),
    supportsScoring: false,
    layout: "cross",
  },
  {
    id: "year",
    name: "年度运势",
    description: "年度主题加上十二个月的连续观察。",
    positions: positions("年度主题", "一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"),
    supportsScoring: false,
    layout: "circle",
  },
  {
    id: "relationship",
    name: "十一张关系牌阵",
    description: "对称比较双方的态度、需求、感受、环境和未来。",
    positions: positions("关系现状", "你的态度", "对方态度", "你的需求", "对方需求", "你的感受", "对方感受", "你的外部环境", "对方外部环境", "你的未来", "对方未来"),
    supportsScoring: false,
    layout: "grid",
  },
  {
    id: "soulmate_z",
    name: "正缘 Z 字牌阵",
    description: "沿 Z 字转折线探索相遇前、缘分发展与相遇后的走向。",
    positions: positions("你的现状", "你的心境", "准备度", "正缘特质", "相遇契机", "初识火花", "关系发展", "共同课题", "关系稳定度", "双方成长", "最终归宿"),
    supportsScoring: false,
    layout: "z",
  },
];

export function getSpreadById(id: string): Spread | undefined {
  return SPREADS.find((spread) => spread.id === id);
}

export interface SpreadPosition {
  index: number;
  name: string;
  hint?: string;
}

export interface Spread {
  id: string;
  name: string;
  description: string;
  positions: readonly SpreadPosition[];
  supportsScoring: boolean;
  layout: "row" | "grid" | "cross" | "z" | "circle";
}

export const SPREADS: readonly Spread[] = [
  {
    id: "five_card_timeline_v1",
    name: "五张时间流",
    description: "时间流视角，照见此刻的路径",
    positions: [
      { index: 1, name: "较远背景" },
      { index: 2, name: "早期状态" },
      { index: 3, name: "中间状态" },
      { index: 4, name: "近期状态" },
      { index: 5, name: "当前状态" },
    ],
    supportsScoring: true,
    layout: "row",
  },
  {
    id: "single",
    name: "单张牌",
    description: "直指此刻最值得看见的核心",
    positions: [{ index: 1, name: "核心讯息" }],
    supportsScoring: false,
    layout: "row",
  },
  {
    id: "triple",
    name: "圣三角",
    description: "过去、现在与未来的连结",
    positions: [
      { index: 1, name: "过去" },
      { index: 2, name: "现在" },
      { index: 3, name: "未来" },
    ],
    supportsScoring: false,
    layout: "row",
  },
];

export function getSpreadById(id: string): Spread | undefined {
  return SPREADS.find((spread) => spread.id === id);
}

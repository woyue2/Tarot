import type { TarotCard } from "./types";

export interface PatternSummary {
  majorMinorRatio: string;
  suitDistribution: string;
  repeatedNumbers: string[];
  repeatedSymbols: string[];
  directionFlow: string;
}

export function aggregatePatterns(cards: readonly TarotCard[]): PatternSummary {
  const majors = cards.filter((card) => card.arcana === "major").length;
  const minors = cards.length - majors;
  const suits = ["wands", "cups", "swords", "pentacles"] as const;
  const suitNames = { wands: "权杖", cups: "圣杯", swords: "宝剑", pentacles: "星币" };
  const suitDistribution = suits
    .map((suit) => [suit, cards.filter((card) => card.suit === suit).length] as const)
    .filter(([, count]) => count > 0)
    .map(([suit, count]) => `${suitNames[suit]} ${count}`)
    .join("、") || "没有小阿尔卡那花色";
  const repeated = <T>(items: readonly T[]) => [...new Set(items.filter((item, index) => items.indexOf(item) !== index))];
  const repeatedNumbers = repeated(cards.map((card) => card.rank).filter((rank) => rank > 0)).map(String);
  const repeatedSymbols = repeated(cards.flatMap((card) => card.visual.symbols.map((symbol) => symbol.name)));
  const directions = cards.map((card) => card.visual.direction).filter(Boolean);
  const directionFlow = directions.length === 0 ? "未提供明确人物朝向" : [...new Set(directions)].join(" → ");
  return {
    majorMinorRatio: `大阿尔卡那 ${majors} / 小阿尔卡那 ${minors}`,
    suitDistribution,
    repeatedNumbers,
    repeatedSymbols,
    directionFlow,
  };
}

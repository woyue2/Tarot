import { describe, expect, it } from "vitest";
import type { TarotCard } from "@tarot/core";
import { buildInterpretationInput } from "./interpretation-input";

const card = (index: number): TarotCard => ({
  id: `major-${String(index).padStart(2, "0")}`,
  name: `牌${index}`,
  nameEn: `Card ${index}`,
  aliases: [],
  arcana: "major",
  rank: index,
  image: `cards/${index}.webp`,
  visual: { sourceHeading: "", direction: "向前", posture: "站立", colors: "金色", lighting: "柔光", symbols: [], story: "旅程", pitfalls: "" },
  scores: {
    upright: { semantic: 2, dynamic: 1, rank: 0, final: index, basis: "test" },
    reversed: { semantic: -2, dynamic: -1, rank: 0, final: -index, basis: "test" },
  },
});

describe("interpretation input", () => {
  it("creates a validated, reproducible five-card payload", () => {
    const cards = Array.from({ length: 5 }, (_, index) => card(index));
    const input = buildInterpretationInput({
      readingId: "reading-1",
      question: "未来三个月的工作发展如何？",
      mode: "manual",
      selected: cards.map((item) => ({ cardId: item.id, orientation: "upright" as const })),
      cards,
      metadata: { contentVersion: "content-1", scoreTableVersion: "score-1", methodologyVersion: "method-1", methodologyStyle: "生活化" },
    });
    expect(input.cards).toHaveLength(5);
    expect(input.cards[4]?.positionName).toBe("当前状态");
    expect(input.draw.confirmed).toBe(true);
  });

  it("builds an energy-flow payload for a non-scored advanced spread", () => {
    const cards = Array.from({ length: 3 }, (_, index) => card(index));
    const input = buildInterpretationInput({
      readingId: "reading-flow",
      question: "我该如何理解眼前的选择？",
      mode: "random",
      spreadId: "triple",
      scoring: false,
      energyFlow: true,
      selected: cards.map((item) => ({ cardId: item.id, orientation: "upright" as const })),
      cards,
      metadata: { contentVersion: "content-1", scoreTableVersion: "score-1", methodologyVersion: "method-1", methodologyStyle: "生活化" },
    });
    expect(input.cards).toHaveLength(3);
    expect(input.calculation).toBeUndefined();
    expect(input.patterns?.majorMinorRatio).toBe("大阿尔卡那 3 / 小阿尔卡那 0");
  });
});

import { describe, expect, it } from "vitest";
import { calculateMomentumValue, cardScore, rankScore, roundHalfAway } from "./scoring";

describe("roundHalfAway", () => {
  it.each([
    [0.5, 1],
    [-0.5, -1],
    [1.5, 2],
    [-1.5, -2],
    [2.49, 2],
    [-2.49, -2],
  ])("rounds %s to %s", (value, expected) => expect(roundHalfAway(value)).toBe(expected));
});

describe("tarot scoring", () => {
  it("matches the Sun example", () => {
    const rank = rankScore("major", 19);
    expect(cardScore(10, 8, rank)).toBe(10);
  });

  it("matches the career example", () => {
    expect(calculateMomentumValue([6, -4, 5, -5, -2])).toEqual({
      values: [6, -4, 5, -5, -2],
      momentum: -1,
      momentumLabel: "不动或不明确",
      value: -1.7419,
      valueLabel: "负价值",
    });
  });
});

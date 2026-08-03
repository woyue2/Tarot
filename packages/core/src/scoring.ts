export const FORMULA_VERSION = "momentum-value-v0.1";

export function roundHalfAway(value: number): number {
  return Math.sign(value) * Math.floor(Math.abs(value) + 0.5);
}

export function rankScore(arcana: "major" | "minor", number: number): number {
  if (arcana === "major") {
    if (number < 0 || number > 21) throw new RangeError("Major Arcana number must be between 0 and 21");
    return (20 * number) / 21 - 10;
  }
  if (number < 1 || number > 14) throw new RangeError("Minor Arcana rank must be between 1 and 14");
  return (20 * (number - 1)) / 13 - 10;
}

export function cardScore(semantic: number, dynamic: number, rank: number): number {
  return roundHalfAway(0.8 * semantic + 0.15 * dynamic + 0.05 * rank);
}

export interface MomentumValueResult {
  values: [number, number, number, number, number];
  momentum: number;
  momentumLabel: "动" | "不动或不明确" | "反向动量";
  value: number;
  valueLabel: "有价值" | "价值不明确" | "负价值";
}

export function calculateMomentumValue(values: readonly number[]): MomentumValueResult {
  if (values.length !== 5) throw new RangeError("Exactly five values are required");
  const [x1, x2, x3, x4, x5] = values as [number, number, number, number, number];
  const momentum = ((x2 - x1) + 2 * (x3 - x2) + 3 * (x4 - x3) + 4 * (x5 - x4)) / 10;
  const value = (x5 + 0.5 * x4 + 0.25 * x3 + 0.125 * x2 + 0.0625 * x1) / 1.9375;
  return {
    values: [x1, x2, x3, x4, x5],
    momentum: Number(momentum.toFixed(4)),
    momentumLabel: momentum > 1 ? "动" : momentum < -1 ? "反向动量" : "不动或不明确",
    value: Number(value.toFixed(4)),
    valueLabel: value > 1 ? "有价值" : value < -1 ? "负价值" : "价值不明确",
  };
}

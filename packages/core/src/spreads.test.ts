import { describe, expect, it } from "vitest";
import { SELECTABLE_SPREADS, SPREADS, getSpreadById } from "./spreads";

describe("spread registry", () => {
  it("contains the documented core spreads with sequential position indexes", () => {
    expect(SELECTABLE_SPREADS).toHaveLength(32);
    expect(SPREADS).toHaveLength(33);

    for (const spread of SPREADS) {
      expect(spread.positions.length).toBeGreaterThan(0);
      expect(spread.positions.map((position) => position.index)).toEqual(
        Array.from({ length: spread.positions.length }, (_, index) => index + 1),
      );
      expect(new Set(spread.positions.map((position) => position.name)).size).toBe(spread.positions.length);
      expect(new Set(spread.positions.map((position) => position.id)).size).toBe(spread.positions.length);
      const positionIds = new Set(spread.positions.map((position) => position.id));
      for (const stage of spread.reading.stages) {
        expect(stage.positionIds.every((id) => positionIds.has(id))).toBe(true);
      }
      for (const relation of spread.reading.relations) {
        expect(relation.positionIds.every((id) => positionIds.has(id))).toBe(true);
      }
    }
  });

  it("preserves the source section number in every selectable UI name", () => {
    for (const spread of SELECTABLE_SPREADS) {
      expect(spread.section).toMatch(/^[123]\.\d+(?:\.\d+)?$/);
      expect(spread.name.startsWith(`${spread.section}（`)).toBe(true);
    }
  });

  it("contains fifteen numbered three-card presets", () => {
    const triples = SELECTABLE_SPREADS.filter((spread) => spread.familyId === "triple");
    expect(triples).toHaveLength(15);
    expect(triples[0]?.section).toBe("1.2");
    expect(triples.at(-1)?.section).toBe("1.3.14");
    expect(triples.every((spread) => spread.positions.length === 3)).toBe(true);
  });

  it("keeps scoring exclusive to the compatible five-card timeline", () => {
    expect(getSpreadById("five_card_timeline_v1")?.positions).toHaveLength(5);
    expect(getSpreadById("five_card_timeline_v1")?.supportsScoring).toBe(true);
    expect(SPREADS.filter((spread) => spread.supportsScoring)).toHaveLength(1);
  });

  it("supports layouts and card counts required by complex spreads", () => {
    expect(getSpreadById("single")?.positions).toHaveLength(1);
    expect(getSpreadById("celtic_cross")?.positions).toHaveLength(10);
    expect(getSpreadById("soulmate_z")?.positions).toHaveLength(11);
    expect(getSpreadById("year")?.positions).toHaveLength(13);
    expect(getSpreadById("year_months_12")?.positions).toHaveLength(12);
    expect(getSpreadById("red_thread")?.positions).toHaveLength(6);
  });

  it("keeps source qualifiers in user-facing names", () => {
    expect(getSpreadById("gypsy_cross")?.name).toContain("5张·爱情专用");
    expect(getSpreadById("celtic_cross_11")?.name).toContain("含建议牌");
    expect(getSpreadById("venus")?.name).toContain("8张·爱情深度");
    expect(getSpreadById("soulmate_z")?.name).toContain("Z字形·11张");
  });
});

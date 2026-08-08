import { describe, expect, it } from "vitest";
import { SPREADS, getSpreadById } from "./spreads";

describe("spread registry", () => {
  it("contains the documented core spreads with sequential position indexes", () => {
    expect(SPREADS.length).toBeGreaterThanOrEqual(18);

    for (const spread of SPREADS) {
      expect(spread.positions.length).toBeGreaterThan(0);
      expect(spread.positions.map((position) => position.index)).toEqual(
        Array.from({ length: spread.positions.length }, (_, index) => index + 1),
      );
      expect(new Set(spread.positions.map((position) => position.name)).size).toBe(spread.positions.length);
    }
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
  });
});

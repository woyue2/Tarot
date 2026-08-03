import { describe, expect, it } from "vitest";
import { reduceReading } from "./reading-state";
import type { ReadingDraft } from "./types";

const draft = (): ReadingDraft => ({
  id: "reading-1",
  originalQuestion: "我的工作会怎样？",
  resolvedQuestion: "我未来三个月的工作发展如何？",
  mode: "manual",
  status: "selecting",
  shuffleSeed: "seed-1",
  deck: Array.from({ length: 78 }, (_, index) => ({ cardId: `card-${index}`, orientation: "upright" })),
  selectedIndexes: [],
});

describe("reading state", () => {
  it("selects five cards in click order and locks after confirmation", () => {
    let state = draft();
    for (const index of [9, 2, 30, 6, 17]) state = reduceReading(state, { type: "SELECT", index });
    expect(state.selectedIndexes).toEqual([9, 2, 30, 6, 17]);
    expect(state.status).toBe("selected");
    state = reduceReading(state, { type: "CONFIRM" });
    expect(reduceReading(state, { type: "SELECT", index: 1 })).toEqual(state);
  });

  it("removes a middle selection and compacts the order", () => {
    let state: ReadingDraft = { ...draft(), status: "selected", selectedIndexes: [9, 2, 30, 6, 17] };
    state = reduceReading(state, { type: "SELECT", index: 2 });
    expect(state.selectedIndexes).toEqual([9, 30, 6, 17]);
    expect(state.status).toBe("selecting");
  });

  it("defers and retries interpretation without changing cards", () => {
    const revealing = { ...draft(), status: "revealing" as const, selectedIndexes: [0, 1, 2, 3, 4] };
    const pending = reduceReading(revealing, { type: "DEFER_INTERPRETATION" });
    const interpreting = reduceReading(pending, { type: "BEGIN_INTERPRETATION" });
    const failed = reduceReading(interpreting, { type: "FAIL" });
    const retried = reduceReading(failed, { type: "RETRY" });
    expect(retried.status).toBe("interpreting");
    expect(retried.selectedIndexes).toEqual([0, 1, 2, 3, 4]);
  });
});

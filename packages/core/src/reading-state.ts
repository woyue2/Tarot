import type { ReadingDraft } from "./types";

export type ReadingAction =
  | { type: "SELECT"; index: number }
  | { type: "CLEAR_SELECTION" }
  | { type: "CONFIRM" }
  | { type: "BEGIN_REVEAL" }
  | { type: "BEGIN_INTERPRETATION" }
  | { type: "DEFER_INTERPRETATION" }
  | { type: "COMPLETE" }
  | { type: "FAIL" }
  | { type: "RETRY" }
  | { type: "CANCEL" };

export function reduceReading(state: ReadingDraft, action: ReadingAction): ReadingDraft {
  switch (action.type) {
    case "SELECT": {
      if (state.status !== "selecting" && state.status !== "selected") return state;
      if (action.index < 0 || action.index >= state.deck.length) return state;
      const exists = state.selectedIndexes.includes(action.index);
      const selectedIndexes = exists
        ? state.selectedIndexes.filter((index) => index !== action.index)
        : state.selectedIndexes.length < 5
          ? [...state.selectedIndexes, action.index]
          : state.selectedIndexes;
      return { ...state, selectedIndexes, status: selectedIndexes.length === 5 ? "selected" : "selecting" };
    }
    case "CLEAR_SELECTION":
      return state.status === "selecting" || state.status === "selected"
        ? { ...state, selectedIndexes: [], status: "selecting" }
        : state;
    case "CONFIRM":
      return state.status === "selected" && state.selectedIndexes.length === 5 ? { ...state, status: "confirmed" } : state;
    case "BEGIN_REVEAL":
      return state.status === "confirmed" ? { ...state, status: "revealing" } : state;
    case "BEGIN_INTERPRETATION":
      return state.status === "revealing" || state.status === "pending_interpretation" || state.status === "failed"
        ? { ...state, status: "interpreting" }
        : state;
    case "DEFER_INTERPRETATION":
      return state.status === "revealing" || state.status === "failed" ? { ...state, status: "pending_interpretation" } : state;
    case "COMPLETE":
      return state.status === "interpreting" ? { ...state, status: "completed" } : state;
    case "FAIL":
      return state.status === "interpreting" ? { ...state, status: "failed" } : state;
    case "RETRY":
      return state.status === "failed" ? { ...state, status: "interpreting" } : state;
    case "CANCEL":
      return state.status === "completed" || state.status === "cancelled" ? state : { ...state, status: "cancelled" };
  }
}

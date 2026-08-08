import { describe, expect, it } from "vitest";
import { parseHighlight } from "./highlight";

describe("parseHighlight", () => {
  it("returns a single text segment when there is no markup", () => {
    expect(parseHighlight("plain text")).toEqual([{ type: "text", content: "plain text" }]);
  });

  it("parses highlight markers", () => {
    expect(parseHighlight("this ==is important== text")).toEqual([
      { type: "text", content: "this " },
      { type: "highlight", content: "is important" },
      { type: "text", content: " text" },
    ]);
  });

  it("parses wavy markers", () => {
    expect(parseHighlight("this ~~is risky~~ text")).toEqual([
      { type: "text", content: "this " },
      { type: "wavy", content: "is risky" },
      { type: "text", content: " text" },
    ]);
  });

  it("parses mixed markers", () => {
    expect(parseHighlight("==key== and ~~risk~~")).toEqual([
      { type: "highlight", content: "key" },
      { type: "text", content: " and " },
      { type: "wavy", content: "risk" },
    ]);
  });

  it("ignores nested/unclosed markers and treats them as plain text", () => {
    expect(parseHighlight("==unclosed ~~text")).toEqual([{ type: "text", content: "==unclosed ~~text" }]);
  });
});

import { describe, it, expect } from "vitest";
import { scoreAnswer, courseComplete } from "@learnly/shared";

describe("quiz scoring", () => {
  const single = { id: "q", type: "single" as const, points: 4, correct: ["b"] };
  const multi = { id: "m", type: "multiple" as const, points: 2, correct: ["a", "c"] };
  const short = { id: "s", type: "short" as const, points: 1, correct: ["stack", "the stack"] };
  it("scores single choice", () => {
    expect(scoreAnswer(single, "b")).toBe(4);
    expect(scoreAnswer(single, "a")).toBe(0);
    expect(scoreAnswer(single, null)).toBe(0);
  });
  it("multiple needs the exact set, any order", () => {
    expect(scoreAnswer(multi, ["c", "a"])).toBe(2);
    expect(scoreAnswer(multi, ["a"])).toBe(0);
    expect(scoreAnswer(multi, ["a", "b", "c"])).toBe(0);
  });
  it("short answers ignore case and spaces", () => {
    expect(scoreAnswer(short, "  Stack ")).toBe(1);
    expect(scoreAnswer(short, "heap")).toBe(0);
  });
});

describe("completion rule", () => {
  it("needs every lesson and every required quiz", () => {
    expect(courseComplete(["1", "2"], ["1", "2"], [{ id: "q", passed: true }])).toBe(true);
    expect(courseComplete(["1", "2"], ["1"], [])).toBe(false);
    expect(courseComplete(["1"], ["1"], [{ id: "q", passed: false }])).toBe(false);
    expect(courseComplete([], [], [])).toBe(false);
  });
});

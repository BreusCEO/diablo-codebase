import { describe, expect, it } from "vitest";
import { makeItems, itemsHash } from "./dataset";
import { finalInteger, finalNumber, scoreReply } from "./scorer";

describe("scorer: the final integer, read by code", () => {
  it.each([
    ["Answer: 42", 42],
    ["482 * 37 = 17834\n219 * 64 = 14016\n17834 - 14016 + 1375 = 5193\nAnswer: 5193", 5193],
    ["The result is **12,345**.", 12345],
    ["Answer: −1,234", -1234],
    ["Answer: -87", -87],
    ["= 5193.0", 5193],
    ["Steps 2-3 give 40", 40],
    ["It is 17 (step-4 was skipped)", 4],
  ])("%j → %d", (text, n) => {
    expect(finalInteger(text)).toBe(n);
  });

  it("no number, or a non-integer last number, is no answer", () => {
    expect(finalInteger("I cannot compute that.")).toBeNull();
    expect(finalInteger("About 12.5")).toBeNull();
    expect(finalNumber("About 12.5")).toBe(12.5);
    expect(finalInteger("")).toBeNull();
  });

  it("ignores numbers glued to letters (v2, A001)", () => {
    expect(finalInteger("Helper v2")).toBeNull();
    expect(finalInteger("Item A001: 99")).toBe(99);
  });

  it("scores 1 only on an exact match", () => {
    expect(scoreReply("Answer: 5193", 5193)).toMatchObject({ score: 1, parsed: 5193 });
    expect(scoreReply("Answer: 5194", 5193)).toMatchObject({ score: 0, parsed: 5194 });
    expect(scoreReply("no idea", 5193)).toMatchObject({ score: 0, parsed: null });
  });
});

describe("dataset: seeded multi-step arithmetic", () => {
  it("is deterministic, with exact integer answers that match the expression", () => {
    const a = makeItems(30);
    expect(makeItems(30)).toEqual(a);
    expect(itemsHash(makeItems(30))).toBe(itemsHash(a));
    expect(makeItems(30, 7)).not.toEqual(a);
    for (const item of a) {
      expect(Number.isInteger(item.answer)).toBe(true);
      // Evaluate the expression independently (only digits, spaces, + - * and brackets).
      expect(item.expression).toMatch(/^[\d\s()+\-*]+$/);
      expect(Function(`return (${item.expression})`)()).toBe(item.answer);
      expect(item.prompt).toBe(`What is ${item.expression}?`);
    }
    expect(new Set(a.map((x) => x.id)).size).toBe(30);
  });

  it("a longer list starts with the shorter one", () => {
    expect(makeItems(50).slice(0, 20)).toEqual(makeItems(20));
  });
});

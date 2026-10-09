import { describe, expect, it } from "vitest";
import { safeNext } from "./next-path";

describe("safeNext (open-redirect guard)", () => {
  it("keeps same-site relative paths with query and hash", () => {
    expect(safeNext("/investigations/sycophancy-model-x?tab=report#top")).toBe("/investigations/sycophancy-model-x?tab=report#top");
    expect(safeNext("/settings")).toBe("/settings");
  });

  it("falls back for missing or empty values", () => {
    expect(safeNext(null)).toBe("/home");
    expect(safeNext(undefined)).toBe("/home");
    expect(safeNext("")).toBe("/home");
    expect(safeNext("", "")).toBe("");
  });

  it("refuses absolute, protocol-relative and scheme URLs", () => {
    for (const evil of [
      "https://evil.example",
      "//evil.example",
      "///evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "evil.example/home",
      "/\t/evil.example",
      "/\n/evil.example",
      "%2F%2Fevil.example",
    ]) {
      expect(safeNext(evil), evil).toBe("/home");
    }
  });

  it("never points back at sign-in or the auth endpoints", () => {
    expect(safeNext("/")).toBe("/home");
    expect(safeNext("/?error=x")).toBe("/home");
    expect(safeNext("/api/auth/signout")).toBe("/home");
  });

  it("normalises dot segments without leaving the origin", () => {
    expect(safeNext("/a/../settings")).toBe("/settings");
    expect(safeNext("/../../etc")).toBe("/etc");
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { configFor, isTeamMember } = await import("./team");

const env = { ANTHROPIC_API_KEY: "a-key", GEMINI_API_KEY: "g-key", DIABLO_TEAM_EMAILS: "Team@Example.com, two@example.com" };

describe("the Gemini switch is team-only", () => {
  it("recognises team members case-insensitively", () => {
    expect(isTeamMember("team@example.com", env)).toBe(true);
    expect(isTeamMember("someone@example.com", env)).toBe(false);
    expect(isTeamMember(null, env)).toBe(false);
  });
  it("gives Claude to everyone by default", () => {
    expect(configFor("team@example.com", undefined, env).provider).toBe("anthropic");
    expect(configFor("someone@example.com", undefined, env).provider).toBe("anthropic");
  });
  it("gives Gemini only to a team member who asks for it", () => {
    expect(configFor("team@example.com", "gemini", env).provider).toBe("gemini");
    expect(configFor("someone@example.com", "gemini", env).provider).toBe("anthropic");
    expect(configFor(null, "gemini", env).provider).toBe("anthropic");
  });
  it("stays on Claude when no Gemini key is set", () => {
    expect(configFor("team@example.com", "gemini", { ...env, GEMINI_API_KEY: "" }).provider).toBe("anthropic");
  });
});

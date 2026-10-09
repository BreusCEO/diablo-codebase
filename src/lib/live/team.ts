import "server-only";
import { liveConfig, type LiveConfig } from "./env";

type Env = Record<string, string | undefined>;

/**
 * Who may switch the reasoner to Gemini. Everyone else always gets Claude.
 * DIABLO_TEAM_EMAILS is a comma-separated list; empty means nobody.
 */
export function isTeamMember(email: string | null | undefined, env: Env = process.env): boolean {
  if (!email) return false;
  const team = (env.DIABLO_TEAM_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return team.includes(email.trim().toLowerCase());
}

export type Reasoner = "claude" | "gemini";

/**
 * The live configuration for one request. Claude (ANTHROPIC_API_KEY) is the
 * reasoner for everyone; a team member who turned Gemini on in Settings gets
 * Gemini instead, when GEMINI_API_KEY is set. The browser's wish is only a
 * wish: the server decides.
 */
export function configFor(email: string | null | undefined, wanted: Reasoner | undefined, env: Env = process.env): LiveConfig & { reasoner: Reasoner } {
  const gemini = wanted === "gemini" && isTeamMember(email, env) && !!env.GEMINI_API_KEY?.trim();
  const config = liveConfig({ ...env, DIABLO_LLM: gemini ? "gemini" : "anthropic" });
  return { ...config, reasoner: gemini ? "gemini" : "claude" };
}

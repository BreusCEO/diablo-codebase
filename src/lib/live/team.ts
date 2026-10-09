import "server-only";
import { getSystemSettings, type Reasoner } from "@/lib/admin/settings";
import { liveConfig, type LiveConfig } from "./env";

type Env = Record<string, string | undefined>;
export type { Reasoner };

/**
 * The live configuration for every run: Claude Opus 5.5, unless an admin
 * switched the whole system to Gemini in /admin (and GEMINI_API_KEY is set).
 */
export function configForReasoner(reasoner: Reasoner, env: Env = process.env): LiveConfig & { reasoner: Reasoner } {
  const gemini = reasoner === "gemini" && !!env.GEMINI_API_KEY?.trim();
  const config = liveConfig({ ...env, DIABLO_LLM: gemini ? "gemini" : "anthropic" });
  return { ...config, reasoner: gemini ? "gemini" : "claude" };
}

export async function currentConfig(): Promise<LiveConfig & { reasoner: Reasoner }> {
  return configForReasoner((await getSystemSettings()).reasoner);
}

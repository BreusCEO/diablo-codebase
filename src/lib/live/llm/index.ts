import "server-only";
import { providerKey, type LiveConfig } from "../env";
import { geminiLLM } from "./gemini";
import type { LLM } from "./types";
import { zaiLLM } from "./zai";

/**
 * The reasoning model (plans, interprets) and the target model (plays the
 * "Helper" system under test), from the configured provider. Null when no
 * provider is configured: the caller answers 503, nothing is faked.
 */
export function createModels(config: LiveConfig): { reasoning: LLM; target: LLM } | null {
  if (!config.provider) return null;
  const apiKey = providerKey(config.provider);
  if (!apiKey) return null;
  const make = config.provider === "gemini" ? geminiLLM : zaiLLM;
  return {
    reasoning: make({ apiKey, model: config.reasoningModel, timeoutMs: config.caps.reasoningTimeoutMs }),
    target: make({ apiKey, model: config.targetModel, timeoutMs: config.caps.targetTimeoutMs }),
  };
}

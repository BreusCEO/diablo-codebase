import type { ProviderId } from "./types";

/** Default models, checked against the providers' model lists on 9 Oct 2026. Both Gemini models have a free tier. */
export const DEFAULT_MODELS: Record<ProviderId, { reasoning: string; target: string }> = {
  gemini: { reasoning: "gemini-3.8-flash", target: "gemini-3.5-flash-lite" },
  zai: { reasoning: "glm-5.3", target: "glm-4.7-flash" },
};

export const PROVIDER_LABEL: Record<ProviderId, string> = { gemini: "Gemini API", zai: "Z.ai GLM" };

export const KEY_VAR: Record<ProviderId, string> = { gemini: "GEMINI_API_KEY", zai: "ZAI_API_KEY" };

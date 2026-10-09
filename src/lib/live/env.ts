import "server-only";
import { CAP_LIMITS, maxCalls, MIN_ITEMS_PER_ARM, type LiveCaps } from "./budget";
import type { AbuseLimits, LivePublicConfig, ProviderId } from "./types";

/**
 * The one place the live engine reads the environment. Read at request time,
 * so `next build` needs no keys, and keys never leave this module except into
 * an adapter's request header.
 *
 *   GEMINI_API_KEY            Google AI Studio key (free tier, no card)
 *   ZAI_API_KEY               Z.ai key (GLM)
 *   DIABLO_LLM                gemini | zai; else whichever key exists (Gemini first)
 *   DIABLO_REASONING_MODEL    plans and interprets (default per provider below)
 *   DIABLO_TARGET_MODEL       the "Helper" system under test (default per provider below)
 *   LIVE_MAX_EXPERIMENTS, LIVE_MAX_ITEMS_PER_ARM, LIVE_CONCURRENCY,
 *   LIVE_TARGET_TIMEOUT_SECONDS, LIVE_REASONING_TIMEOUT_SECONDS,
 *   LIVE_RUN_DEADLINE_SECONDS  budget overrides, clamped to hard ceilings
 *   LIVE_DAILY_CALL_CAP, LIVE_COOLDOWN_SECONDS, LIVE_MAX_CONCURRENT_RUNS  abuse controls
 */

/** Defaults checked against the providers' model lists on 9 Oct 2026; both Gemini models have a free tier. */
export const DEFAULT_MODELS: Record<ProviderId, { reasoning: string; target: string }> = {
  gemini: { reasoning: "gemini-3.8-flash", target: "gemini-3.5-flash-lite" },
  zai: { reasoning: "glm-5.3", target: "glm-4.7-flash" },
};

export const PROVIDER_LABEL: Record<ProviderId, string> = { gemini: "Gemini API", zai: "Z.ai GLM" };

const KEY_VAR: Record<ProviderId, string> = { gemini: "GEMINI_API_KEY", zai: "ZAI_API_KEY" };

export interface LiveConfig {
  provider: ProviderId | null;
  /** Why no provider is configured, in words for the page. */
  problem: string | null;
  reasoningModel: string;
  targetModel: string;
  caps: LiveCaps;
  limits: AbuseLimits;
}

type Env = Record<string, string | undefined>;

const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

function intEnv(env: Env, name: string, def: number, min: number, max: number, scale = 1): number {
  const raw = env[name]?.trim();
  if (!raw) return def;
  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.round(n * scale)));
}

export function readCaps(env: Env): LiveCaps {
  const L = CAP_LIMITS;
  return {
    maxExperiments: intEnv(env, "LIVE_MAX_EXPERIMENTS", L.maxExperiments.def, L.maxExperiments.min, L.maxExperiments.max),
    maxItemsPerArm: intEnv(env, "LIVE_MAX_ITEMS_PER_ARM", L.maxItemsPerArm.def, L.maxItemsPerArm.min, L.maxItemsPerArm.max),
    minItemsPerArm: MIN_ITEMS_PER_ARM,
    concurrency: intEnv(env, "LIVE_CONCURRENCY", L.concurrency.def, L.concurrency.min, L.concurrency.max),
    targetTimeoutMs: intEnv(env, "LIVE_TARGET_TIMEOUT_SECONDS", L.targetTimeoutMs.def, L.targetTimeoutMs.min, L.targetTimeoutMs.max, 1000),
    reasoningTimeoutMs: intEnv(
      env,
      "LIVE_REASONING_TIMEOUT_SECONDS",
      L.reasoningTimeoutMs.def,
      L.reasoningTimeoutMs.min,
      L.reasoningTimeoutMs.max,
      1000,
    ),
    runDeadlineMs: intEnv(env, "LIVE_RUN_DEADLINE_SECONDS", L.runDeadlineMs.def, L.runDeadlineMs.min, L.runDeadlineMs.max, 1000),
  };
}

export function readLimits(env: Env): AbuseLimits {
  return {
    dailyCallCap: intEnv(env, "LIVE_DAILY_CALL_CAP", 500, 0, 100_000),
    cooldownMs: intEnv(env, "LIVE_COOLDOWN_SECONDS", 60, 0, 3600, 1000),
    maxConcurrentRuns: intEnv(env, "LIVE_MAX_CONCURRENT_RUNS", 2, 1, 4),
  };
}

function pickProvider(env: Env): { provider: ProviderId | null; problem: string | null } {
  const has = (p: ProviderId) => !!env[KEY_VAR[p]]?.trim();
  const wanted = env.DIABLO_LLM?.trim().toLowerCase();
  if (wanted) {
    if (wanted !== "gemini" && wanted !== "zai") return { provider: null, problem: `DIABLO_LLM must be "gemini" or "zai" (it is "${wanted.slice(0, 20)}").` };
    return has(wanted) ? { provider: wanted, problem: null } : { provider: null, problem: `DIABLO_LLM is "${wanted}" but ${KEY_VAR[wanted]} is not set.` };
  }
  if (has("gemini")) return { provider: "gemini", problem: null };
  if (has("zai")) return { provider: "zai", problem: null };
  return { provider: null, problem: "No model key is set: add GEMINI_API_KEY (or ZAI_API_KEY) to the environment." };
}

function model(env: Env, name: string, fallback: string): string | { invalid: string } {
  const v = env[name]?.trim();
  if (!v) return fallback;
  return MODEL_ID.test(v) ? v : { invalid: name };
}

export function liveConfig(env: Env = process.env): LiveConfig {
  const caps = readCaps(env);
  const limits = readLimits(env);
  const { provider, problem } = pickProvider(env);
  const defaults = DEFAULT_MODELS[provider ?? "gemini"];
  const reasoning = model(env, "DIABLO_REASONING_MODEL", defaults.reasoning);
  const target = model(env, "DIABLO_TARGET_MODEL", defaults.target);
  const bad = [reasoning, target].find((m): m is { invalid: string } => typeof m !== "string");
  return {
    provider: bad ? null : provider,
    problem: bad ? `${bad.invalid} is not a valid model id.` : problem,
    reasoningModel: typeof reasoning === "string" ? reasoning : defaults.reasoning,
    targetModel: typeof target === "string" ? target : defaults.target,
    caps,
    limits,
  };
}

/** The key for a provider. Only the adapter factory calls this. */
export function providerKey(provider: ProviderId, env: Env = process.env): string | null {
  return env[KEY_VAR[provider]]?.trim() || null;
}

export function publicConfig(config: LiveConfig = liveConfig()): LivePublicConfig {
  const configured = config.provider !== null;
  return {
    configured,
    provider: config.provider,
    providerLabel: config.provider ? PROVIDER_LABEL[config.provider] : null,
    problem: config.problem,
    reasoningModel: configured ? config.reasoningModel : null,
    targetModel: configured ? config.targetModel : null,
    caps: config.caps,
    limits: config.limits,
    estimate: maxCalls(config.caps),
  };
}


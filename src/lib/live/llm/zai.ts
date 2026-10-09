import "server-only";
import { DEFAULT_RETRY, isObject, postJson, retryAfterHeader, safeMessage, sleep, withRetries, type Fetch, type RetryPolicy, type Sleep } from "./http";
import { LLMError, type LLM, type LLMRequest, type LLMResponse } from "./types";

/**
 * Z.ai GLM adapter: the OpenAI-compatible chat completions endpoint.
 * Thinking is always on; JSON mode is response_format json_object (the only
 * structured mode it offers). Temperature is clamped to the API's 0..1.
 */
export const ZAI_BASE = "https://api.z.ai/api/paas/v4";

export interface ZaiOptions {
  apiKey: string;
  model: string;
  fetch?: Fetch;
  retry?: RetryPolicy;
  sleep?: Sleep;
  timeoutMs?: number;
}

export function zaiRequestBody(model: string, req: LLMRequest) {
  return {
    model,
    messages: [...(req.system ? [{ role: "system", content: req.system }] : []), ...req.messages.map((m) => ({ role: m.role, content: m.content }))],
    ...(req.temperature !== undefined ? { temperature: Math.min(1, Math.max(0, req.temperature)) } : {}),
    ...(req.maxTokens !== undefined ? { max_tokens: req.maxTokens } : {}),
    thinking: { type: "enabled" },
    ...(req.json ? { response_format: { type: "json_object" } } : {}),
    stream: false,
  };
}

export function zaiLLM(opts: ZaiOptions): LLM {
  const fetchImpl = opts.fetch ?? globalThis.fetch;
  const attempt = async (req: LLMRequest): Promise<LLMResponse> => {
    const { status, json, headers } = await postJson(
      fetchImpl,
      `${ZAI_BASE}/chat/completions`,
      { headers: { Authorization: `Bearer ${opts.apiKey}` }, body: zaiRequestBody(opts.model, req) },
      { provider: "zai", timeoutMs: req.timeoutMs ?? opts.timeoutMs ?? 60_000, signal: req.signal, secret: opts.apiKey },
    );
    if (status < 200 || status >= 300) throw classifyZaiError(status, json, headers.get("retry-after"), opts.apiKey);
    return parseZaiResponse(json, opts.model);
  };
  return {
    provider: "zai",
    model: opts.model,
    complete: (req) => withRetries(() => attempt(req), { policy: opts.retry ?? DEFAULT_RETRY, wait: opts.sleep ?? sleep, signal: req.signal }),
  };
}

export function parseZaiResponse(json: unknown, model: string): LLMResponse {
  if (!isObject(json)) throw new LLMError("bad-response", "The answer was not JSON.", { provider: "zai" });
  const choice = Array.isArray(json.choices) && isObject(json.choices[0]) ? json.choices[0] : null;
  const message = choice && isObject(choice.message) ? choice.message : null;
  if (!message) throw new LLMError("bad-response", "The answer had no choices.", { provider: "zai" });
  const usage = isObject(json.usage) ? json.usage : {};
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    // reasoning_content is the model's thinking, not its answer.
    text: typeof message.content === "string" ? message.content : "",
    usage: { inputTokens: n(usage.prompt_tokens), outputTokens: n(usage.completion_tokens) },
    model: typeof json.model === "string" && json.model ? json.model : model,
    finishReason: typeof choice!.finish_reason === "string" ? choice!.finish_reason : null,
  };
}

const QUOTA_CODES = new Set([1113, 1308, 1309, 1310, 1311, 1314, 1315, 1316, 1317, 1318, 1319, 1320, 1321]);
const AUTH_CODES = new Set([1000, 1001, 1002, 1003, 1004, 1005]);

/** Z.ai errors: { error: { code: "1302", message } } with an HTTP status. */
export function classifyZaiError(status: number, json: unknown, retryAfter: string | null, apiKey: string): LLMError {
  const err = isObject(json) && isObject(json.error) ? json.error : {};
  const code = Number(err.code);
  const raw = typeof err.message === "string" ? err.message : isObject(json) && typeof json.__raw === "string" ? json.__raw : "";
  const message = safeMessage(raw, apiKey);
  const base = { provider: "zai" as const, status };
  const say = (what: string) => `Z.ai ${status}${Number.isFinite(code) ? ` (code ${code})` : ""}: ${message || what}`;
  if (status === 401 || AUTH_CODES.has(code)) return new LLMError("auth", say("the key was rejected"), base);
  if (status === 404 || code === 1211 || code === 1221 || code === 1222) return new LLMError("model-not-found", say("model not found"), base);
  if (QUOTA_CODES.has(code)) return new LLMError("quota", say("quota or balance exhausted"), base);
  if (status === 429) return new LLMError("rate-limit", say("rate limited"), { ...base, retryAfterMs: retryAfterHeader(retryAfter) });
  if (status >= 500) return new LLMError("server", say("server error"), { ...base, retryAfterMs: retryAfterHeader(retryAfter) });
  if (status === 403) return new LLMError("auth", say("permission denied"), base);
  return new LLMError("bad-request", say("request refused"), base);
}

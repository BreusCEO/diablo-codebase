import { describe, expect, it, vi } from "vitest";
import { classifyZaiError, ZAI_BASE, zaiLLM } from "./zai";

const KEY = "zai-secret-key-abcdef.0123456789";
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const fail = (status: number, code: number | string, message = "error") => new Response(JSON.stringify({ error: { code, message } }), { status });
const reply = {
  model: "glm-5.3",
  choices: [{ index: 0, message: { role: "assistant", content: '{"ok":true}', reasoning_content: "let me think" }, finish_reason: "stop" }],
  usage: { prompt_tokens: 20, completion_tokens: 9, total_tokens: 29 },
};

describe("Z.ai adapter", () => {
  it("sends an OpenAI-style chat completion with thinking on and JSON mode as json_object", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => ok(reply));
    const res = await zaiLLM({ apiKey: KEY, model: "glm-5.3", fetch }).complete({
      system: "sys",
      messages: [{ role: "user", content: "q" }],
      json: true,
      temperature: 1.4,
      maxTokens: 300,
    });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`${ZAI_BASE}/chat/completions`);
    expect((init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(String(init?.body))).toEqual({
      model: "glm-5.3",
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "q" },
      ],
      temperature: 1, // clamped to the API's 0..1
      max_tokens: 300,
      thinking: { type: "enabled" },
      response_format: { type: "json_object" },
      stream: false,
    });
    // The answer is content; reasoning_content is the thinking.
    expect(res).toEqual({ text: '{"ok":true}', usage: { inputTokens: 20, outputTokens: 9 }, model: "glm-5.3", finishReason: "stop" });
  });

  it("classifies errors by HTTP status and business code", () => {
    expect(classifyZaiError(401, { error: { code: "1000", message: "auth" } }, null, KEY).kind).toBe("auth");
    expect(classifyZaiError(400, { error: { code: 1211, message: "unknown model" } }, null, KEY).kind).toBe("model-not-found");
    expect(classifyZaiError(429, { error: { code: "1113", message: "balance" } }, null, KEY).kind).toBe("quota");
    expect(classifyZaiError(429, { error: { code: "1302", message: "rate" } }, "3", KEY)).toMatchObject({ kind: "rate-limit", retryAfterMs: 3000 });
    expect(classifyZaiError(500, { error: { code: "1234", message: "network" } }, null, KEY).kind).toBe("server");
    expect(classifyZaiError(400, { error: { code: "1210", message: "bad param" } }, null, KEY).kind).toBe("bad-request");
  });

  it("retries a 1302 rate limit, not a 1113 balance error, and never leaks the key", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(fail(429, "1302")).mockResolvedValueOnce(ok(reply));
    const llm = zaiLLM({ apiKey: KEY, model: "glm-4.7-flash", fetch, retry: { retries: 2, baseDelayMs: 1, maxDelayMs: 2 }, sleep: async () => {} });
    expect((await llm.complete({ system: "", messages: [{ role: "user", content: "x" }] })).text).toBe('{"ok":true}');
    expect(fetch).toHaveBeenCalledTimes(2);

    const broke = vi.fn<typeof globalThis.fetch>(async () => fail(429, "1113", `Insufficient balance for key ${KEY}`));
    const err = await zaiLLM({ apiKey: KEY, model: "m", fetch: broke, sleep: async () => {} }).complete({ system: "", messages: [] }).catch((e) => e);
    expect(err.kind).toBe("quota");
    expect(broke).toHaveBeenCalledTimes(1);
    expect(err.message).not.toContain(KEY);
    expect(JSON.stringify(err)).not.toContain(KEY);
  });
});

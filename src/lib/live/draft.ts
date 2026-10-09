/**
 * DRAFT: the reasoning model proposes hypotheses and experiments as JSON.
 * The plan is validated against closed vocabularies built from the registry
 * (only registry factors, only their values, n within the budget). A rejected
 * plan goes back to the model with the validator's reasons, at most twice.
 * If no valid plan arrives, the run fails: a plan is never invented.
 */
import { z } from "zod";
import type { LiveCaps } from "./budget";
import { MAX_DRAFT_CALLS } from "./budget";
import { LiveError } from "./errors";
import { extractJson } from "./json";
import type { LLM, LLMMessage } from "./llm/types";
import { changedFactors, FACTORS, QUESTION, settingsKey, V1, V2, type Settings } from "./registry";
import type { Plan } from "./types";

const PREDICTIONS = ["increase", "decrease", "no-difference"] as const;

/** Predictions state a direction; an effect size would be a number the model invented. */
export const NUMERIC_CLAIM = /\d\s*(%|pp\b|percentage|percent)|\bper ?cent\b|percentage points?/i;

function closedValue<T extends readonly string[]>(values: T) {
  return z.preprocess((v) => {
    if (typeof v === "string") return v.trim().toLowerCase();
    if (typeof v === "number") return values.find((x) => Number(x) === v) ?? v;
    return v;
  }, z.enum(values));
}

const temperatureValue = z.preprocess((v) => {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\s*\d+(\.\d+)?\s*$/.test(v) ? Number(v) : NaN;
  if (!Number.isFinite(n)) return v;
  return FACTORS.temperature.values.find((x) => Number(x) === n) ?? v;
}, z.enum(FACTORS.temperature.values));

/** One arm: exactly the registry's factors, each with one of its values. */
export const settingsSchema = z
  .object({
    system_prompt: closedValue(FACTORS.system_prompt.values),
    temperature: temperatureValue,
  })
  .strict();

const noNumbers = (s: string) => !NUMERIC_CLAIM.test(s);

export function planSchema(caps: LiveCaps) {
  const hypothesis = z.object({
    id: z.string().regex(/^H[1-9]$/, 'Hypothesis ids are "H1", "H2", …'),
    text: z.string().trim().min(10).max(280).refine(noNumbers, "State a direction only; no effect sizes or percentages"),
    prediction: closedValue(PREDICTIONS),
    competing: z.boolean(),
  });
  const experiment = z.object({
    hypothesis: z.string().regex(/^H[1-9]$/, 'Refer to a hypothesis id such as "H1"'),
    title: z.string().trim().min(4).max(100).refine(noNumbers, "No effect sizes or percentages in titles"),
    control: settingsSchema,
    treatment: settingsSchema,
    items_per_arm: z.number().int().min(caps.minItemsPerArm).max(caps.maxItemsPerArm),
    rationale: z.string().trim().max(300).optional(),
  });
  return z
    .object({
      hypotheses: z.array(hypothesis).min(2, "Propose at least two competing hypotheses").max(caps.maxExperiments),
      experiments: z.array(experiment).min(2).max(caps.maxExperiments),
    })
    .superRefine((plan, ctx) => {
      const ids = plan.hypotheses.map((h) => h.id);
      if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", path: ["hypotheses"], message: "Hypothesis ids must be unique" });
      if (!plan.hypotheses.some((h) => h.competing)) {
        ctx.addIssue({ code: "custom", path: ["hypotheses"], message: "Mark at least one hypothesis as competing: true (an alternative explanation)" });
      }
      const seen = new Set<string>();
      plan.experiments.forEach((e, i) => {
        if (!ids.includes(e.hypothesis)) {
          ctx.addIssue({ code: "custom", path: ["experiments", i, "hypothesis"], message: `No hypothesis ${e.hypothesis} in this plan` });
        }
        if (changedFactors(e.control as Settings, e.treatment as Settings).length === 0) {
          ctx.addIssue({ code: "custom", path: ["experiments", i], message: "Control and treatment are identical; change at least one factor" });
        }
        const key = `${settingsKey(e.control as Settings)}→${settingsKey(e.treatment as Settings)}`;
        if (seen.has(key)) ctx.addIssue({ code: "custom", path: ["experiments", i], message: "Duplicate of an earlier experiment" });
        seen.add(key);
      });
      ids.forEach((id) => {
        if (!plan.experiments.some((e) => e.hypothesis === id)) {
          ctx.addIssue({ code: "custom", path: ["hypotheses"], message: `${id} is not tested by any experiment` });
        }
      });
    });
}

const describePath = (path: readonly PropertyKey[]) => (path.length ? path.map(String).join(".") : "plan");

/** Validate a parsed reply. Problems are short, so they can be fed back to the model. */
export function validatePlan(value: unknown, caps: LiveCaps): { ok: true; plan: Plan } | { ok: false; problems: string[] } {
  const parsed = planSchema(caps).safeParse(value);
  if (!parsed.success) {
    const problems = parsed.error.issues.slice(0, 12).map((i) => `${describePath(i.path)}: ${i.message}`);
    return { ok: false, problems };
  }
  const p = parsed.data;
  return {
    ok: true,
    plan: {
      hypotheses: p.hypotheses.map((h) => ({ id: h.id, text: h.text, prediction: h.prediction, competing: h.competing })),
      experiments: p.experiments.map((e, i) => ({
        id: `E${i + 1}`,
        hypothesisId: e.hypothesis,
        title: e.title,
        rationale: e.rationale?.trim() || null,
        control: e.control as Settings,
        treatment: e.treatment as Settings,
        n: e.items_per_arm,
      })),
    },
  };
}

const quote = (s: Settings) => `{"system_prompt": "${s.system_prompt}", "temperature": "${s.temperature}"}`;

export function draftSystemPrompt(caps: LiveCaps): string {
  return [
    "You are the research planner in Diablo, a tool that finds out why an AI system's behaviour changed.",
    "You propose hypotheses and experiments. Code runs them, scores every answer and computes every statistic; you never see results while planning.",
    "",
    'The system under investigation is "Helper", an arithmetic assistant. Helper v2 changed two factors at once:',
    `- system_prompt: v1 "full" (work step by step, end with an "Answer: <integer>" line) became v2 "short" ("reply with the result only").`,
    `- temperature: v1 "0.2" became v2 "1.0".`,
    `Helper v1 is ${quote(V1.settings)}. Helper v2 is ${quote(V2.settings)}.`,
    "",
    "Factors you may vary (a closed vocabulary: any other factor or value is rejected):",
    `- system_prompt: ${FACTORS.system_prompt.values.map((v) => `"${v}"`).join(" | ")}`,
    `- temperature: ${FACTORS.temperature.values.map((v) => `"${v}"`).join(" | ")}`,
    "",
    "Dataset: seeded multi-step integer arithmetic with exact answers. Metric: accuracy, the share of items whose final integer equals the exact answer, scored by code.",
    "Every experiment is paired: the same items run in both arms. A positive difference means the treatment arm is more accurate than the control arm.",
    `Budget: at most ${caps.maxExperiments} experiments, each with ${caps.minItemsPerArm} to ${caps.maxItemsPerArm} items per arm. More items give tighter intervals.`,
    "",
    "Task: propose at least two competing hypotheses about which change explains any difference between v1 and v2, and experiments that test them.",
    "Every hypothesis must be tested by at least one experiment. Prefer experiments that change exactly one factor relative to Helper v1, so an effect can be attributed to that factor.",
    "",
    "Fields:",
    '- hypotheses[]: id ("H1", "H2", …), text (one sentence; a direction only, never a number for an effect size), prediction ("increase" | "decrease" | "no-difference": the expected sign of treatment minus control accuracy in the experiments that test it), competing (true for an alternative explanation).',
    "- experiments[]: hypothesis (an id above), title (short), control and treatment (objects with exactly the keys system_prompt and temperature), items_per_arm (an integer), rationale (one sentence).",
    "",
    'Reply with one JSON object only, shaped like {"hypotheses": [...], "experiments": [...]}.',
  ].join("\n");
}

export interface DraftOptions {
  llm: LLM;
  caps: LiveCaps;
  signal?: AbortSignal;
  onAttempt?: (attempt: number, ok: boolean, problems: string[]) => void;
}

/** Ask for a plan, validate it, and feed problems back at most twice. Throws when no valid plan arrives. */
export async function draftPlan({ llm, caps, signal, onAttempt }: DraftOptions): Promise<{ plan: Plan; attempts: number }> {
  const system = draftSystemPrompt(caps);
  const messages: LLMMessage[] = [{ role: "user", content: QUESTION }];
  let lastProblems: string[] = [];
  for (let attempt = 1; attempt <= MAX_DRAFT_CALLS; attempt++) {
    const res = await llm.complete({ system, messages, json: true, maxTokens: 8192, signal, timeoutMs: caps.reasoningTimeoutMs });
    const json = extractJson(res.text);
    const result = json.ok ? validatePlan(json.value, caps) : { ok: false as const, problems: [json.error] };
    onAttempt?.(attempt, result.ok, result.ok ? [] : result.problems);
    if (result.ok) return { plan: result.plan, attempts: attempt };
    lastProblems = result.problems;
    messages.push(
      { role: "assistant", content: res.text.slice(0, 8000) || "(empty reply)" },
      {
        role: "user",
        content: `The validator rejected that plan:\n${result.problems.map((p) => `- ${p}`).join("\n")}\nReply with the corrected JSON object only.`,
      },
    );
  }
  throw new LiveError("draft-invalid", `The reasoning model did not produce a valid plan in ${MAX_DRAFT_CALLS} attempts. Last problems: ${lastProblems.slice(0, 4).join("; ")}`);
}

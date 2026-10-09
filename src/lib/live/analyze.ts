/**
 * ANALYZE: turn counted outcomes into the app's own Investigation shape and
 * let the existing statistics do the rest (src/lib/data/derive.ts: exact
 * McNemar and a paired bootstrap for paired runs, Holm across experiments,
 * verdicts; src/lib/validity.ts: checks C1–C9). No statistics are written
 * here.
 */
import { analyzeExperiment, hashString, holmAdjusted, verdictFor, type RunResult, type Verdict } from "@/lib/data/derive";
import { experimentInterpretation } from "@/lib/data/interpret";
import type { AISystem, Experiment, Investigation, Run, Sample, SessionEvent } from "@/lib/data/types";
import { assess, type Assessment } from "@/lib/validity";
import { DATASET, itemsHash, type Item } from "./dataset";
import { armConfig, armLabel, helperSystems, QUESTION, TITLE, versionOf, V2, type Settings } from "./registry";
import type { ExperimentOutcome, RunOutcome } from "./runner";
import type { Models, Plan } from "./types";

export const METRIC = {
  name: "Accuracy",
  definition: "Share of items whose final integer in the reply equals the exact answer",
  positiveLabel: "Correct",
  negativeLabel: "Wrong or no integer",
  higherIs: "better" as const,
};

export const SCORER = {
  kind: "rule" as const,
  name: "Final-integer exact match (code)",
  family: null,
  humanAgreement: null,
  humanAgreementN: null,
};

/** The family the target's model belongs to, for check C4. */
export function familyOfModel(model: string): string {
  if (/^claude/i.test(model)) return "Claude";
  if (/^gemini/i.test(model)) return "Gemini";
  if (/^glm/i.test(model)) return "GLM";
  return model.split(/[-_.]/)[0] || model;
}

export function liveSystems(models: Models): AISystem[] {
  return helperSystems(models.target, familyOfModel(models.target));
}

const systemIdOf = (s: Settings) => versionOf(s)?.id ?? "helper-v1";
const MAX_TEXT = 4000;

interface BuildInput {
  id: string;
  plan: Plan;
  outcome: RunOutcome;
  items: Item[];
  models: Models;
  startedAt: number;
  /** When each stage happened, for the session log. */
  times: { planned: number; ran: number };
}

function samplesFor(runId: string, expId: string, o: ExperimentOutcome): Sample[] {
  return o.pairs.flatMap((p) =>
    (["control", "treatment"] as const).map((arm) => {
      const call = p[arm];
      return {
        id: `${runId}/${arm}-${p.item.id}`,
        runId,
        experimentId: expId,
        arm,
        itemId: p.item.id,
        prompt: p.item.prompt,
        response: call.response.length > MAX_TEXT ? `${call.response.slice(0, MAX_TEXT - 1)}…` : call.response,
        score: call.score ?? 0,
        rationale: call.rationale,
        flagged: false,
        traceId: null,
        simulated: false,
      };
    }),
  );
}

/** The investigation, built from the plan and the counted outcomes. */
export function buildInvestigation({ id, plan, outcome, items, models, startedAt, times }: BuildInput): Investigation {
  const iso = (t: number) => new Date(t).toISOString();
  const used = items.slice(0, Math.max(...plan.experiments.map((e) => e.n)));
  const hash = itemsHash(used);
  const experiments: Experiment[] = plan.experiments.map((pe) => {
    const o = outcome.experiments.find((x) => x.id === pe.id)!;
    const runId = `${id}/${pe.id}/primary-1`;
    const done = o.pairs.length > 0;
    const run: Run = {
      id: runId,
      experimentId: pe.id,
      role: "primary",
      startedAt: iso(outcome.startedAt),
      finishedAt: iso(outcome.finishedAt),
      expectedDurationMs: Math.max(1, outcome.finishedAt - outcome.startedAt),
      counts: done ? o.counts : null,
      discordant: done ? o.discordant : null,
      sweep: null,
      grid: null,
      modelVersion: outcome.model ?? models.target,
      params: { "control temperature": pe.control.temperature, "treatment temperature": pe.treatment.temperature },
      datasetHash: hash,
      configHash: `cfg:${hashString(JSON.stringify([pe.control, pe.treatment, models.target])).toString(16).padStart(8, "0")}`,
      tokens: o.tokens,
      costUsd: null,
      samples: samplesFor(runId, pe.id, o),
      traces: [],
    };
    return {
      id: pe.id,
      title: pe.title,
      hypothesisId: pe.hypothesisId,
      status: done ? "complete" : "failed",
      design: {
        datasetId: DATASET.id,
        control: { label: armLabel(pe.control), systemId: systemIdOf(pe.control), config: armConfig(pe.control, models.target) },
        treatment: { label: armLabel(pe.treatment), systemId: systemIdOf(pe.treatment), config: armConfig(pe.treatment, models.target) },
        metric: METRIC,
        scorer: SCORER,
        nPerArm: pe.n,
        seed: DATASET.seed,
        // Not randomised: every item runs in both arms (paired), from a fixed seed.
        randomized: false,
        pairing: "paired",
        temperature: null,
        primary: true,
        sweep: null,
        grid: null,
      },
      runs: [run],
      createdAt: iso(times.planned),
      updatedAt: iso(outcome.finishedAt),
      simulation: null,
    };
  });

  const inv: Investigation = {
    id,
    title: TITLE,
    question: QUESTION,
    systemId: V2.id,
    createdAt: iso(startedAt),
    updatedAt: iso(outcome.finishedAt),
    hypotheses: plan.hypotheses,
    experiments,
    events: [],
    notes: "",
    pinned: false,
    templateDraft: false,
    failed: experiments.every((e) => e.status === "failed"),
  };

  let seq = 0;
  const ev = (kind: SessionEvent["kind"], at: number, text: string, refs: string[], experimentId: string | null): SessionEvent => ({
    id: `${id}/ev-${++seq}`,
    kind,
    at: iso(at),
    text,
    refs,
    experimentId,
  });
  const events: SessionEvent[] = [
    ev("question", startedAt, QUESTION, [], null),
    ev("hypotheses", times.planned, `Proposed ${plan.hypotheses.length} hypotheses (reasoning model ${models.reasoning})`, plan.hypotheses.map((h) => h.id), null),
    ...plan.experiments.map((e) => ev("design", times.planned, `Designed ${e.id} · ${e.title}`, [e.id, e.hypothesisId], e.id)),
    ...plan.experiments.map((e) => ev("run-started", outcome.startedAt, `Started ${e.id} on ${models.target}`, [e.id], e.id)),
    ...experiments.map((e) =>
      e.status === "complete"
        ? ev("run-finished", times.ran, `Ran ${e.id} · ${e.title}`, [e.id], e.id)
        : ev("note", times.ran, `${e.id} has no completed pairs, so there is no result`, [e.id], e.id),
    ),
  ];
  const analysed = experiments.filter((e) => e.status === "complete");
  return {
    ...inv,
    events: [...events, ...analysed.map((e) => ev("analysis", times.ran, experimentInterpretation(e), [e.id, e.hypothesisId], e.id))],
  };
}

export interface Analysis {
  results: Map<string, RunResult>;
  holm: Map<string, number>;
  verdicts: Map<string, Verdict>;
  assessment: Assessment;
}

/** Everything derived, through the app's own functions. */
export function analyze(inv: Investigation, models: Models): Analysis {
  const results = new Map<string, RunResult>();
  for (const e of inv.experiments) {
    const r = analyzeExperiment(e);
    if (r) results.set(e.id, r);
  }
  const systems = liveSystems(models);
  const familyOf = (systemId: string) => systems.find((s) => s.id === systemId)?.family ?? null;
  return {
    results,
    holm: holmAdjusted(inv),
    verdicts: new Map(inv.hypotheses.map((h) => [h.id, verdictFor(inv, h).verdict])),
    assessment: assess(inv, familyOf),
  };
}

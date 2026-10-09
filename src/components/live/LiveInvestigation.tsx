"use client";

import { useEffect, useReducer, useRef } from "react";
import { Check, ExternalLink, KeyRound, Play, Square, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Progress, SectionTitle } from "@/components/ui/primitives";
import { Mono } from "@/components/research/common";
import { cn } from "@/lib/cn";
import { useNow } from "@/lib/data";
import { count } from "@/lib/format";
import { DATASET } from "@/lib/live/dataset";
import { ERROR_HINT } from "@/lib/live/llm/types";
import { INITIAL_VIEW, liveReducer, readEvents, type Attempt, type LiveView, type StageState } from "@/lib/live/progress";
import { DEFAULT_MODELS } from "@/lib/live/providers";
import { armLabel, changedFactors, FACTORS, QUESTION, SYSTEM_PROMPTS, VERSIONS } from "@/lib/live/registry";
import type { LivePublicConfig, LiveStage, Plan } from "@/lib/live/types";
import { LiveResults } from "./LiveResults";

const STAGE_COPY: Record<LiveStage, { label: string; who: "model" | "code"; text: string }> = {
  draft: { label: "Plan", who: "model", text: "The reasoning model proposes hypotheses and experiments; code checks them against the registry." },
  run: { label: "Run", who: "code", text: "Code calls the target on the same seeded items in both arms and scores every answer." },
  analyze: { label: "Analyse", who: "code", text: "Code computes the exact McNemar test, a paired bootstrap interval and the Holm correction." },
  interpret: { label: "Interpret", who: "model", text: "The model explains the result citing only the fact table; a checker verifies every number." },
};

const seconds = (ms: number) => `${Math.round(ms / 1000)} s`;
const minutes = (ms: number) => (ms >= 60_000 && ms % 60_000 === 0 ? `${ms / 60_000} min` : seconds(ms));

export function LiveInvestigation({ config }: { config: LivePublicConfig }) {
  const [view, dispatch] = useReducer(liveReducer, INITIAL_VIEW);
  const abortRef = useRef<AbortController | null>(null);

  // Leaving the page cancels a run in progress: no model calls nobody will see.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function start() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    dispatch({ type: "request" });
    try {
      const res = await fetch("/api/live/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        signal: ctrl.signal,
        cache: "no-store",
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        const message =
          res.status === 401
            ? "Your session has ended. Reload the page to sign in again."
            : (body?.message ?? `The server answered with status ${res.status}.`);
        dispatch({ type: "http-error", status: res.status, message });
        return;
      }
      await readEvents(res.body, dispatch);
      dispatch({ type: "stream-ended" });
    } catch {
      if (ctrl.signal.aborted) dispatch({ type: "cancelled" });
      else dispatch({ type: "http-error", status: 0, message: "The server could not be reached. Check your connection and try again." });
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  }

  const busy = view.status === "starting" || view.status === "running";

  return (
    <div className="space-y-10">
      <Scenario />
      <Roles config={config} />
      <section aria-labelledby="run-h">
        <SectionTitle id="run-h">Run</SectionTitle>
        {config.configured ? (
          <div className="mt-2 rounded-[10px] border border-line bg-surface p-4 sm:p-5">
            <Budget config={config} />
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {busy ? (
                <Button variant="secondary" icon={<Square strokeWidth={1.5} />} onClick={() => abortRef.current?.abort()}>
                  Cancel
                </Button>
              ) : (
                <Button variant="primary" icon={<Play strokeWidth={1.5} />} onClick={start}>
                  {view.status === "idle" ? "Run live investigation" : "Run again"}
                </Button>
              )}
              {busy && <Elapsed since={view.startedAt} />}
            </div>
            {view.status !== "idle" && <Stages view={view} />}
            {view.error && <ErrorNote view={view} />}
          </div>
        ) : (
          <NotConfigured config={config} />
        )}
        <Announcer view={view} />
      </section>
      {view.plan && !view.result && <PlanView plan={view.plan} reasoning={view.models?.reasoning ?? config.reasoningModel} />}
      {view.result && <LiveResults result={view.result} />}
    </div>
  );
}

/* ── The scenario ─────────────────────────────────────────────── */

function Scenario() {
  return (
    <section aria-labelledby="scenario-h" className="rise">
      <SectionTitle id="scenario-h" className="text-ink-3">
        The planted change
      </SectionTitle>
      <p className="mt-1.5 max-w-[760px] text-[19px] leading-[28px] tracking-[-0.01em] text-ink">{QUESTION}</p>
      <ul className="mt-4 grid gap-3 md:grid-cols-2" aria-label="Helper versions">
        {VERSIONS.map((v, i) => {
          const changed = i === 0 ? [] : changedFactors(VERSIONS[0].settings, v.settings);
          return (
            <li key={v.id} className="rounded-[10px] border border-line bg-surface p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[15px] font-medium text-ink">{v.name}</span>
                {i > 0 && <span className="text-[12px] text-accent-text">{changed.length} factors changed</span>}
              </div>
              <dl className="mt-3 space-y-2.5 text-[13px]">
                <div>
                  <dt className={cn("text-ink-3", changed.includes("system_prompt") && "text-accent-text")}>System prompt</dt>
                  <dd className="mt-0.5 whitespace-pre-line rounded-[6px] bg-subtle px-2.5 py-2 font-mono text-[12px] leading-[18px] text-ink-2">
                    {SYSTEM_PROMPTS[v.settings.system_prompt]}
                  </dd>
                </div>
                <div className="flex items-baseline gap-2">
                  <dt className={cn("text-ink-3", changed.includes("temperature") && "text-accent-text")}>Temperature</dt>
                  <dd>
                    <Mono className="text-ink">{v.settings.temperature}</Mono>
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 max-w-[760px] text-[13px] text-ink-2">
        Items: {DATASET.description} Accuracy is scored by code: the last integer in the reply must equal the exact answer. Every experiment is
        paired, so both arms answer the same items.
      </p>
    </section>
  );
}

/* ── Who does what ────────────────────────────────────────────── */

function Roles({ config }: { config: LivePublicConfig }) {
  const reasoning = config.reasoningModel ?? DEFAULT_MODELS.gemini.reasoning;
  return (
    <section aria-labelledby="roles-h">
      <SectionTitle id="roles-h">The AI reasons. The system measures.</SectionTitle>
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        <div className="rounded-[10px] border border-line bg-surface p-4">
          <div className="text-[13px] text-ink-3">
            Reasoning model <Mono className="text-ink-2">{reasoning}</Mono>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2 marker:text-ink-3">
            <li>Proposes competing hypotheses and the experiments that test them, as JSON.</li>
            <li>Writes the conclusion with placeholders such as {"{{F3}}"}; it cannot type a number.</li>
          </ul>
        </div>
        <div className="rounded-[10px] border border-line bg-surface p-4">
          <div className="text-[13px] text-ink-3">Code</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2 marker:text-ink-3">
            <li>Rejects any plan outside the registry: only the {Object.keys(FACTORS).length} factors, only their values, within the budget.</li>
            <li>Calls the target, scores every answer and counts discordant pairs.</li>
            <li>Computes every rate, interval and p-value, and checks each number in the conclusion.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ── Budget and limits, before anyone presses Run ─────────────── */

function Budget({ config }: { config: LivePublicConfig }) {
  const { estimate, caps, limits } = config;
  return (
    <div className="space-y-2 text-[13px] text-ink-2">
      <p>
        <span className="text-ink">Models:</span> reasoning <Mono className="text-ink">{config.reasoningModel}</Mono>, target{" "}
        <Mono className="text-ink">{config.targetModel}</Mono> via {config.providerLabel}.
      </p>
      <p>
        <span className="text-ink">Up to {count(estimate.total)} model calls:</span> {estimate.draft} to plan, {count(estimate.target)} to run the target (
        {caps.maxExperiments} experiments × 2 arms × {caps.maxItemsPerArm} items at most), {estimate.interpret} to write the conclusion. Usually fewer:
        an arm two experiments share is called once per item.
      </p>
      <p className="text-ink-3">
        The run stops starting calls after {minutes(caps.runDeadlineMs)} and analyses the pairs it finished. One run per session at a time, then a{" "}
        {seconds(limits.cooldownMs)} pause; this server allows {count(limits.dailyCallCap)} model calls a day.
      </p>
    </div>
  );
}

function Elapsed({ since }: { since: string | null }) {
  const now = useNow(1000, true);
  if (!since || !now) return null;
  const s = Math.max(0, Math.floor((now - Date.parse(since)) / 1000));
  return (
    <span className="font-mono text-[13px] text-ink-3 tabular" aria-label={`Elapsed ${s} seconds`}>
      {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}
    </span>
  );
}

/* ── Stages ───────────────────────────────────────────────────── */

function StageIcon({ state }: { state: StageState }) {
  if (state === "done") return <Check className="size-4 text-ok" strokeWidth={2} aria-hidden />;
  if (state === "failed") return <X className="size-4 text-bad" strokeWidth={2} aria-hidden />;
  if (state === "active") return <span aria-hidden className="block size-2 rounded-full bg-accent-text running-pulse" />;
  return <span aria-hidden className="block size-2 rounded-full border border-ink-3" />;
}

const STATE_WORD: Record<StageState, string> = { pending: "Waiting", active: "In progress", done: "Done", failed: "Stopped" };

function Stages({ view }: { view: LiveView }) {
  return (
    <ol className="mt-5 divide-y divide-line border-y border-line" aria-label="Stages">
      {(Object.keys(STAGE_COPY) as LiveStage[]).map((stage) => {
        const copy = STAGE_COPY[stage];
        const state = view.stages[stage];
        return (
          <li key={stage} className="flex gap-3 py-3">
            <span className="grid size-5 shrink-0 place-items-center pt-0.5">
              <StageIcon state={state} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className={cn("font-medium", state === "pending" ? "text-ink-3" : "text-ink")}>{copy.label}</span>
                <span className="text-[12px] text-ink-3">
                  {copy.who === "model" ? "model" : "code"} · <span className="sr-only">status: </span>
                  {STATE_WORD[state]}
                </span>
              </div>
              <p className="mt-0.5 text-[13px] text-ink-2">{copy.text}</p>
              {stage === "draft" && <AttemptNotes attempts={view.draftAttempts} what="plan" />}
              {stage === "run" && view.progress && <RunCounts view={view} />}
              {stage === "interpret" && <AttemptNotes attempts={view.interpretAttempts} what="conclusion" />}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function AttemptNotes({ attempts, what }: { attempts: Attempt[]; what: "plan" | "conclusion" }) {
  if (!attempts.length) return null;
  return (
    <ul className="mt-1.5 space-y-1 text-[13px]">
      {attempts.map((a) => (
        <li key={a.attempt} className={a.ok ? "text-ok" : "text-ink-2"}>
          Attempt {a.attempt}: {a.ok ? (what === "plan" ? "valid plan" : "every number checked") : `rejected (${a.problems.slice(0, 2).join("; ")}${a.problems.length > 2 ? "; …" : ""})`}
        </li>
      ))}
    </ul>
  );
}

function RunCounts({ view }: { view: LiveView }) {
  const p = view.progress!;
  const tokens = view.usage ? view.usage.byStage.run.inputTokens + view.usage.byStage.run.outputTokens : 0;
  return (
    <div className="mt-2 max-w-[520px]">
      <Progress value={p.total ? p.done / p.total : 0} label="Target calls finished" />
      <p className="mt-1.5 font-mono text-[12px] text-ink-2 tabular">
        {count(p.done)} of {count(p.total)} calls · {count(p.scored)} scored
        {p.failed ? ` · ${count(p.failed)} failed` : ""}
        {p.cancelled ? ` · ${count(p.cancelled)} not run` : ""} · {count(tokens)} tokens
      </p>
    </div>
  );
}

function ErrorNote({ view }: { view: LiveView }) {
  const e = view.error!;
  const hint = e.kind ? ERROR_HINT[e.kind] : null;
  const title = e.code === "aborted" ? "Run cancelled" : e.code === "draft-invalid" ? "No valid plan" : "The run stopped";
  return (
    <div role="alert" className="mt-4 rounded-[10px] border border-line-strong bg-subtle px-4 py-3 text-[13px]">
      <div className="font-medium text-ink">{title}</div>
      <p className="mt-0.5 text-ink-2">{e.message}</p>
      {hint && hint !== e.message && <p className="mt-1 text-ink-3">{hint}</p>}
      {e.code !== "aborted" && <p className="mt-1 text-ink-3">Nothing was published: results appear only when every stage finishes.</p>}
    </div>
  );
}

/** Says stage changes and the outcome to screen readers, not every counter tick. */
function Announcer({ view }: { view: LiveView }) {
  const active = (Object.keys(view.stages) as LiveStage[]).find((s) => view.stages[s] === "active");
  const text =
    view.status === "done"
      ? "Live investigation finished. Results are below."
      : view.status === "failed"
        ? "Live investigation stopped."
        : view.status === "cancelled"
          ? "Live investigation cancelled."
          : active
            ? `${STAGE_COPY[active].label} in progress.`
            : view.status === "starting"
              ? "Starting the live investigation."
              : "";
  return (
    <p className="sr-only" aria-live="polite">
      {text}
    </p>
  );
}

/* ── The plan, as soon as it is validated ─────────────────────── */

function PlanView({ plan, reasoning }: { plan: Plan; reasoning: string | null }) {
  return (
    <section aria-labelledby="plan-h">
      <SectionTitle id="plan-h">Plan</SectionTitle>
      <p className="mt-0.5 text-[13px] text-ink-3">Proposed by {reasoning ?? "the reasoning model"}; validated against the registry before any call to the target.</p>
      <ul className="mt-2 divide-y divide-line border-y border-line">
        {plan.hypotheses.map((h) => (
          <li key={h.id} className="flex gap-4 py-2.5">
            <Mono className="w-8 shrink-0 pt-px text-ink-3">{h.id}</Mono>
            <p className="text-ink">
              {h.text}
              {h.competing && <span className="text-ink-3"> · competing explanation</span>}
            </p>
          </li>
        ))}
        {plan.experiments.map((e) => (
          <li key={e.id} className="flex gap-4 py-2.5">
            <Mono className="w-8 shrink-0 pt-px text-ink-3">{e.id}</Mono>
            <div className="min-w-0">
              <p className="text-ink">
                {e.title} <span className="text-ink-3">· tests {e.hypothesisId}</span>
              </p>
              <p className="mt-0.5 text-[13px] text-ink-2">
                {armLabel(e.control)} → {armLabel(e.treatment)} · {e.n} items per arm, paired
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── No key: say so, and how to add one ───────────────────────── */

function NotConfigured({ config }: { config: LivePublicConfig }) {
  return (
    <div className="mt-2 rounded-[10px] border border-line bg-surface p-4 sm:p-5" aria-labelledby="nokey-h" role="region">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-accent-tint text-accent-text">
          <KeyRound className="size-4" strokeWidth={1.5} aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 id="nokey-h" className="text-[15px] font-medium text-ink">
            Live runs need a model key
          </h3>
          <p className="mt-1 max-w-[680px] text-ink-2">
            This server has no model key, so nothing runs here and nothing on this page is simulated. {config.problem}
          </p>
        </div>
      </div>
      <ol className="mt-4 max-w-[720px] list-decimal space-y-2 pl-5 text-ink-2 marker:text-ink-3">
        <li>
          Create a free Gemini API key in Google AI Studio (the free tier needs no card):{" "}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent-text underline underline-offset-2">
            aistudio.google.com <ExternalLink className="size-3.5" strokeWidth={1.5} aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </li>
        <li>
          On Vercel, open the project’s Settings → Environment Variables and add <Mono className="text-ink">GEMINI_API_KEY</Mono> (or{" "}
          <Mono className="text-ink">ZAI_API_KEY</Mono> for Z.ai GLM). Locally, put it in <Mono className="text-ink">.env.local</Mono>.
        </li>
        <li>
          Redeploy. Optional: <Mono className="text-ink">DIABLO_REASONING_MODEL</Mono> (default <Mono>{DEFAULT_MODELS.gemini.reasoning}</Mono>) and{" "}
          <Mono className="text-ink">DIABLO_TARGET_MODEL</Mono> (default <Mono>{DEFAULT_MODELS.gemini.target}</Mono>).
        </li>
      </ol>
      <p className="mt-4 text-[13px] text-ink-3">
        With a key, one run makes at most {count(config.estimate.total)} model calls. Until then, the rest of the workspace runs on demo data.
      </p>
      <div className="mt-4">
        <Button variant="primary" icon={<Play strokeWidth={1.5} />} disabledReason="No model key is configured on this server">
          Run live investigation
        </Button>
      </div>
    </div>
  );
}

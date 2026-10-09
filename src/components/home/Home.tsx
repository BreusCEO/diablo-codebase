"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { InvestigationRow, RowSkeleton } from "@/components/research/InvestigationRow";
import { EmptyState, Progress } from "@/components/ui/primitives";
import { StatusDot } from "@/components/ui/Status";
import { runProgress } from "@/lib/data/derive";
import type { Investigation } from "@/lib/data/types";
import { count } from "@/lib/format";
import { cn } from "@/lib/cn";
import { provider, sortInvestigations, useNow, useWorkspace } from "@/lib/data";
import { Composer, type ComposerHandle } from "./Composer";
import { SystemPicker, useSelectedSystem } from "./SystemPicker";
import { LEGAL } from "@/components/shell/nav";

/** The product's primitives, each with three example questions (from the project brief). */
const STARTERS: { label: string; examples: string[] }[] = [
  {
    label: "Evaluate",
    examples: [
      "Is Model X v4 calibrated on medical questions?",
      "How often does Agent Y call a tool with malformed arguments?",
      "Does Model Z keep formatting constraints over a long conversation?",
    ],
  },
  {
    label: "Compare",
    examples: [
      "Is v4 better than v3 on our support tickets?",
      "Does Model X v4 agree with false claims more often than v3?",
      "Does Model X v4 hallucinate less than v3 on unanswerable questions?",
    ],
  },
  {
    label: "Ablate",
    examples: [
      "Is the system prompt or retrieval causing this failure?",
      "Do schema examples in tool descriptions reduce malformed calls?",
      "Does restating constraints mid-conversation restore adherence?",
    ],
  },
  {
    label: "Audit",
    examples: [
      "Does Agent Y skip safety checks when rushed?",
      "Does Model X refuse benign requests that mention weapons?",
      "Does the Helpdesk app invent policy details it can't find?",
    ],
  },
];

export function Home() {
  const router = useRouter();
  const ws = useWorkspace();
  const now = useNow(60_000, ws.ready);
  const [system, setSystem] = useSelectedSystem();
  const [starter, setStarter] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const composer = useRef<ComposerHandle>(null);

  // Every time Home becomes visible (first visit or coming back through the
  // sidebar), the composer is empty, enabled and focused. Effects re-run when a
  // route hidden by Activity is shown again; pending comes from the navigation
  // transition, so it can never stay stuck.
  useEffect(() => {
    if (matchMedia("(pointer: fine)").matches) composer.current?.focus();
  }, []);

  const recent = sortInvestigations(ws.investigations).slice(0, 5);
  const active = STARTERS.find((s) => s.label === starter);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[720px] flex-col px-4 pb-8 pt-[clamp(48px,18vh,168px)] sm:px-6">
      <h1 className="rise text-center text-[30px] font-semibold leading-[38px] tracking-[-0.022em] text-ink sm:text-[32px] sm:leading-[40px]">
        What do you want to find out?
      </h1>

      <Composer
        ref={composer}
        id="composer-input"
        className="rise mt-8 [--d:60ms]"
        label="Describe what you want to find out about an AI system"
        placeholder="Describe what you want to find out about an AI system…"
        pending={pending}
        onSubmit={(text) => {
          const id = provider.createInvestigation(text, system);
          startTransition(() => router.push(`/investigations/${id}`));
        }}
        left={<SystemPicker value={system} onChange={setSystem} />}
      />

      <div className="rise mt-4 flex flex-wrap justify-center gap-2 [--d:120ms]" role="group" aria-label="Starting points">
        {STARTERS.map((s) => (
          <button
            key={s.label}
            type="button"
            aria-expanded={starter === s.label}
            aria-controls="starter-examples"
            onClick={() => setStarter((cur) => (cur === s.label ? null : s.label))}
            className={cn(
              "h-8 rounded-full border px-3.5 text-[13px] transition-[color,background-color,border-color,transform] duration-150 hover:-translate-y-px active:translate-y-0",
              starter === s.label ? "border-accent-text bg-accent-tint text-accent-text" : "border-line text-ink-2 hover:bg-sunken hover:text-ink",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div id="starter-examples" className="mt-2">
        {active && (
          <ul className="flex flex-col items-center gap-0.5" aria-label={`${active.label} examples`}>
            {active.examples.map((ex) => (
              <li key={ex}>
                <button
                  type="button"
                  onClick={() => composer.current?.fill(ex)}
                  className="rounded-[6px] px-2 py-1.5 text-center text-[14px] text-ink-2 transition-colors duration-150 hover:bg-sunken hover:text-ink"
                >
                  {ex}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {ws.ready && <RunningNow investigations={ws.investigations} />}

      <section aria-labelledby="recent-heading" className="rise mt-10 [--d:180ms]">
        <div className="mb-1 flex items-baseline justify-between px-3">
          <h2 id="recent-heading" className="text-[14px] font-medium text-ink">
            Recent investigations
          </h2>
          <Link href="/investigations" className="inline-flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink">
            View all <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />
          </Link>
        </div>
        {!ws.ready ? (
          <RowSkeleton />
        ) : recent.length === 0 ? (
          <EmptyState>No investigations yet. Ask a question above to start one.</EmptyState>
        ) : (
          <ul aria-label="Recent investigations">
            {recent.map((inv) => (
              <InvestigationRow key={inv.id} inv={inv} now={now} />
            ))}
          </ul>
        )}
      </section>

      <footer className="mt-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-16 text-[12px] text-ink-3">
        {LEGAL.map((l, i) => (
          <span key={l.href} className="flex items-center gap-3">
            {i > 0 && <span aria-hidden>·</span>}
            <Link href={l.href} className="hover:text-ink">
              {l.short}
            </Link>
          </span>
        ))}
        {provider.kind === "mock" && (
          <>
            <span aria-hidden>·</span>
            <span>{provider.label}</span>
          </>
        )}
      </footer>
    </div>
  );
}

/** Experiments collecting data right now, with live progress (derived from the clock). */
function RunningNow({ investigations }: { investigations: Investigation[] }) {
  const live = investigations.flatMap((inv) =>
    inv.experiments
      .filter((e) => e.status === "running")
      .map((e) => ({ inv, e, run: e.runs.find((r) => r.finishedAt === null) }))
      .filter((x) => x.run),
  );
  const now = useNow(1000, live.length > 0);
  if (!live.length) return null;
  return (
    <section aria-labelledby="running-heading" className="rise mt-10 [--d:150ms]">
      <h2 id="running-heading" className="mb-1 px-3 text-[14px] font-medium text-ink">
        Running now
      </h2>
      <ul aria-label="Running experiments">
        {live.map(({ inv, e, run }) => {
          const p = runProgress(run!, now);
          const total = e.design.nPerArm * 2;
          return (
            <li key={`${inv.id}-${e.id}`}>
              <Link
                href={`/investigations/${inv.id}?tab=overview&exp=${e.id}`}
                className="group relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 transition-colors duration-150 hover:bg-sunken"
              >
                <StatusDot status="running" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] text-ink">
                    <span className="font-mono text-ink-3">{e.id}</span> {e.title}
                  </span>
                  <span className="block truncate text-[13px] text-ink-3">
                    {inv.title} · {count(Math.floor(p * total))} of {count(total)} scored
                  </span>
                </span>
                <Progress value={p} label={`${e.id} progress`} className="hidden w-32 sm:block" />
                <span className="w-10 shrink-0 text-right font-mono text-[13px] text-ink-2 tabular">{Math.round(p * 100)}%</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

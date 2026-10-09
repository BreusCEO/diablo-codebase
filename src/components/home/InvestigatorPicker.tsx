"use client";

import * as P from "@radix-ui/react-popover";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";

/** The same setting as Settings → Reasoning model. The server decides who may use Gemini. */
const KEY = "diablo.reasoner";
type Investigator = "claude" | "gemini";

const INVESTIGATORS: { id: Investigator; name: string; sub: string; teamOnly: boolean }[] = [
  { id: "claude", name: "Claude Opus 5.5", sub: "Anthropic · default investigator", teamOnly: false },
  { id: "gemini", name: "Gemini 3.8 Flash", sub: "Google · team only", teamOnly: true },
];

const listeners = new Set<() => void>();
function read(): Investigator {
  try {
    return localStorage.getItem(KEY) === "gemini" ? "gemini" : "claude";
  } catch {
    return "claude";
  }
}
function write(next: Investigator) {
  try {
    if (next === "gemini") localStorage.setItem(KEY, "gemini");
    else localStorage.removeItem(KEY);
  } catch {}
  listeners.forEach((l) => l());
}

/** The investigator model that plans the experiments and explains the result. */
export function InvestigatorPicker() {
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState(false);
  useLayoutEffect(() => () => setOpen(false), []);
  const value = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    read,
    () => "claude" as Investigator,
  );

  useEffect(() => {
    let alive = true;
    fetch("/api/live/options", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((o: { canUseGemini?: boolean } | null) => {
        if (alive) setTeam(!!o?.canUseGemini);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const options = INVESTIGATORS.filter((i) => !i.teamOnly || team);
  const current = options.find((i) => i.id === value) ?? INVESTIGATORS[0];

  return (
    <P.Root open={open} onOpenChange={setOpen}>
      <P.Trigger asChild>
        <button
          type="button"
          aria-label={`Investigator model: ${current.name}. Change`}
          className="flex h-8 max-w-full items-center gap-1 rounded-[6px] px-2 text-[13px] text-ink-2 transition-colors duration-150 hover:bg-sunken hover:text-ink data-[state=open]:bg-sunken"
        >
          <span className="truncate">{current.name}</span>
          <ChevronDown className="size-4 shrink-0 text-ink-3" strokeWidth={1.5} />
        </button>
      </P.Trigger>
      <P.Portal>
        <P.Content
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className="pop-in z-50 w-[300px] overflow-hidden rounded-[10px] border border-line bg-surface p-1 shadow-[var(--shadow-2)]"
        >
          <p className="px-2 pb-1 pt-2 text-[12px] text-ink-3">Investigator model</p>
          <ul role="listbox" aria-label="Investigator model">
            {options.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={m.id === current.id}
                  onClick={() => {
                    write(m.id);
                    setOpen(false);
                  }}
                  className="flex min-h-10 w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left hover:bg-sunken focus-visible:bg-sunken"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] text-ink">{m.name}</span>
                    <span className="block text-[12px] text-ink-3">{m.sub}</span>
                  </span>
                  {m.id === current.id && <Check className="size-4 text-ink-2" strokeWidth={1.5} aria-label="Selected" />}
                </button>
              </li>
            ))}
          </ul>
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}

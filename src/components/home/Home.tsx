"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { provider } from "@/lib/data";
import { useSession } from "@/components/auth/SessionProvider";
import { Composer, type ComposerHandle } from "./Composer";
import { InvestigatorPicker } from "./InvestigatorPicker";
import { useSelectedSystem } from "./SystemPicker";

export function Home() {
  const router = useRouter();
  const session = useSession();
  const [system] = useSelectedSystem();
  const [pending, startTransition] = useTransition();
  const composer = useRef<ComposerHandle>(null);

  // Every time Home becomes visible (first visit or coming back through the
  // sidebar), the composer is empty, enabled and focused. Effects re-run when a
  // route hidden by Activity is shown again; pending comes from the navigation
  // transition, so it can never stay stuck.
  useEffect(() => {
    if (matchMedia("(pointer: fine)").matches) composer.current?.focus();
  }, []);

  return (
    <>
      {/* A broad burgundy glow filling the page, brightest under the question, darkening toward every edge. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: [
              "radial-gradient(ellipse 48% 42% at 58% 66%, rgb(140 16 56 / 0.35) 0%, transparent 70%)",
              "radial-gradient(ellipse 92% 88% at 50% 58%, rgb(122 10 46 / 0.6) 0%, rgb(97 4 34 / 0.46) 28%, rgb(87 0 26 / 0.24) 52%, rgb(87 0 26 / 0.08) 70%, transparent 86%)",
            ].join(", "),
          }}
        />
        {/* Dark mode: a deep vignette, as on Gemini's start page. */}
        <div
          className="absolute inset-0 hidden dark:block"
          style={{ background: "radial-gradient(ellipse 100% 100% at 50% 56%, transparent 38%, rgb(8 3 5 / 0.55) 72%, rgb(4 1 2 / 0.85) 100%)" }}
        />
      </div>
      <div className="relative mx-auto flex min-h-full w-full max-w-[720px] flex-col px-4 pb-8 pt-[clamp(96px,34vh,380px)] sm:px-6">
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
            // A real workspace runs the real engine; the demo workspace keeps its labelled sample flow.
            if (session && !session.demo) {
              startTransition(() =>
                router.push(
                  `/live?q=${encodeURIComponent(text.slice(0, 400))}`,
                ),
              );
              return;
            }
            const id = provider.createInvestigation(text, system);
            startTransition(() => router.push(`/investigations/${id}`));
          }}
          left={<InvestigatorPicker />}
        />
      </div>
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { provider } from "@/lib/data";
import { useSession } from "@/components/auth/SessionProvider";
import { Composer, type ComposerHandle } from "./Composer";
import { SystemPicker, useSelectedSystem } from "./SystemPicker";

export function Home() {
  const router = useRouter();
  const session = useSession();
  const [system, setSystem] = useSelectedSystem();
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
      {/* A burgundy glow rising from the bottom of the page. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[55vh]"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 120%, rgb(87 0 26 / 0.34) 0%, rgb(87 0 26 / 0.14) 40%, transparent 72%)",
        }}
      />
      <div className="relative mx-auto flex min-h-full w-full max-w-[720px] flex-col px-4 pb-8 pt-[clamp(48px,18vh,168px)] sm:px-6">
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
          left={<SystemPicker value={system} onChange={setSystem} />}
        />
      </div>
    </>
  );
}

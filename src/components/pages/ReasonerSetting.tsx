"use client";

import { useEffect, useState } from "react";
import { Segmented } from "@/components/ui/Segmented";

const KEY = "diablo.reasoner";
type Choice = "claude" | "gemini";

/**
 * The reasoning model, for team members only: Claude Opus 5.5 by default, or
 * Google Gemini. Hidden for everyone else, and the server enforces it anyway.
 */
export function ReasonerSetting({ Row }: { Row: (p: { title: string; sub: string; children: React.ReactNode }) => React.ReactNode }) {
  const [allowed, setAllowed] = useState(false);
  const [choice, setChoice] = useState<Choice>("claude");

  useEffect(() => {
    let alive = true;
    fetch("/api/live/options", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((o: { canUseGemini?: boolean } | null) => {
        if (!alive || !o?.canUseGemini) return;
        setAllowed(true);
        try {
          setChoice(localStorage.getItem(KEY) === "gemini" ? "gemini" : "claude");
        } catch {}
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!allowed) return null;
  return (
    <Row title="Reasoning model" sub="Team only. Claude Opus 5.5 is the default for everyone; Google turns Gemini on for your live runs instead.">
      <Segmented<Choice>
        label="Reasoning model"
        value={choice}
        onChange={(v) => {
          setChoice(v);
          try {
            if (v === "gemini") localStorage.setItem(KEY, "gemini");
            else localStorage.removeItem(KEY);
          } catch {}
        }}
        items={[
          { value: "claude", label: "Claude Opus 5.5" },
          { value: "gemini", label: "Google Gemini" },
        ]}
      />
    </Row>
  );
}

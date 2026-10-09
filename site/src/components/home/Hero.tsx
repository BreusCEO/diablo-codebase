"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform, useVelocity } from "motion/react";
import { LiveMark } from "@/components/LiveMark";
import { TryButton } from "@/components/TryButton";
import { FLICK, INSTANT, UI, soft, usePan } from "@/lib/motion";

const QUESTIONS = [
  "Why did it get worse?",
  "What is it bad at?",
  "What changed?",
  "Why does it behave this way?",
  "How can we make it better?",
];

const delay = (s: number) => ({ "--d": `${s}s` }) as React.CSSProperties;

export function Hero() {
  return (
    <section className="relative">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 md:pt-24 lg:grid-cols-[1.15fr_0.85fr] lg:pb-28">
        <div>
          <p className="rise t-overline text-accent-text">AI evolution</p>
          <h1 className="rise t-hero mt-5 text-balance" style={delay(0.06)}>
            AI that evolves <span className="text-accent-text">AI.</span>
          </h1>
          <p className="rise t-lead mt-7 max-w-xl text-pretty text-ink-2" style={delay(0.14)}>
            Give Diablo an AI system and a question. It forms hypotheses, runs controlled experiments and turns what it
            finds into knowledge you can trust.
          </p>
          <div className="rise mt-9 flex flex-wrap items-center gap-3" style={delay(0.22)}>
            <TryButton size="lg" />
            <a
              href="#loop"
              className="press inline-flex h-[3.25rem] items-center rounded-full border border-line-strong px-6 text-[1.0625rem] font-semibold transition-colors hover:bg-accent-tint"
            >
              How it works
            </a>
          </div>
          <div className="rise mt-12 max-w-md" style={delay(0.3)}>
            <QuestionBox />
          </div>
        </div>

        <div className="rise" style={delay(0.12)}>
          <FlingTile />
        </div>
      </div>
    </section>
  );
}

/**
 * The mark on its tile. Grab it anywhere: it lifts on press, follows the
 * pointer 1:1 from where it was grabbed, resists the further it goes, leans
 * into its own velocity, and on release springs home carrying that velocity.
 * Grab it again mid-flight and it simply follows again.
 */
function FlingTile() {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const lift = useMotionValue(1);
  const vx = useVelocity(x);
  const lean = useSpring(useTransform(vx, [-2400, 0, 2400], [-14, 0, 14]), { stiffness: 260, damping: 26 });
  const [held, setHeld] = useState(false);
  const start = useRef({ x: 0, y: 0 });

  const onPointerDown = usePan({
    axis: "free",
    threshold: 0,
    onDown: () => {
      // Interrupt whatever is in flight; the tile is wherever it is on screen right now.
      x.stop();
      y.stop();
      start.current = { x: x.get(), y: y.get() };
      setHeld(true);
      animate(lift, 1.04, reduce ? INSTANT : UI);
    },
    onMove: ({ dx, dy }) => {
      x.set(soft(start.current.x + dx, -40, 40, 260));
      y.set(soft(start.current.y + dy, -40, 40, 260));
    },
    onEnd: ({ vx: vX, vy: vY }) => release(vX, vY),
    onTap: () => release(0, 0),
  });

  function release(vX: number, vY: number) {
    setHeld(false);
    animate(lift, 1, reduce ? INSTANT : UI);
    // X and Y are separate springs, so a diagonal throw settles naturally.
    animate(x, 0, reduce ? INSTANT : { ...FLICK, velocity: vX });
    animate(y, 0, reduce ? INSTANT : { ...FLICK, velocity: vY });
  }

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[26rem] select-none">
      <motion.div
        onPointerDown={onPointerDown}
        style={{ x, y, scale: lift, rotate: reduce ? 0 : lean, touchAction: "none" }}
        className={`absolute inset-[10%] grid place-items-center rounded-[26%] bg-burgundy text-cream shadow-3 ${held ? "cursor-grabbing" : "cursor-grab"}`}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{ boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.14), inset 0 -1px 0 rgb(0 0 0 / 0.2)" }}
        />
        <LiveMark size={168} intro="full" track blink title="Diablo" />
      </motion.div>
      <p className="t-caption absolute inset-x-0 -bottom-2 text-center text-ink-3" aria-hidden>
        Grab it.
      </p>
    </div>
  );
}

/** The questions people bring to Diablo, typed out. Tap to skip to the next one. */
function QuestionBox() {
  const reduce = useReducedMotion();
  const [qi, setQi] = useState(0);
  const [n, setN] = useState(0);
  const q = QUESTIONS[qi];

  useEffect(() => {
    if (reduce) {
      const t = setTimeout(() => setQi((i) => (i + 1) % QUESTIONS.length), 3600);
      return () => clearTimeout(t);
    }
    let t: ReturnType<typeof setTimeout>;
    if (n < q.length) t = setTimeout(() => setN(n + 1), 38 + ((n * 37) % 40));
    else
      t = setTimeout(() => {
        setQi((i) => (i + 1) % QUESTIONS.length);
        setN(0);
      }, 2200);
    return () => clearTimeout(t);
  }, [n, q, reduce]);

  return (
    <button
      type="button"
      onClick={() => {
        setQi((i) => (i + 1) % QUESTIONS.length);
        setN(0);
      }}
      className="press block w-full rounded-[1.25rem] border bg-surface p-1.5 text-left shadow-2"
      aria-label={`Example question: ${q} Show the next one.`}
    >
      <span className="flex items-center gap-3 rounded-[0.9rem] bg-subtle px-4 py-3.5">
        <span className="t-overline shrink-0 rounded-md bg-accent px-1.5 py-0.5 text-[0.625rem] text-accent-ink">Ask</span>
        <span className="t-body min-h-[1.55em] flex-1 font-medium" aria-hidden>
          {reduce ? q : q.slice(0, n)}
          {!reduce && <span className="caret" />}
        </span>
      </span>
      <span className="t-caption flex items-center gap-2 px-3 pb-1.5 pt-2.5 text-ink-3" aria-hidden>
        <span className="flex gap-1">
          {QUESTIONS.map((_, i) => (
            <span key={i} className={`h-1 rounded-full transition-all duration-300 ${i === qi ? "w-4 bg-accent-text" : "w-1 bg-line-strong"}`} />
          ))}
        </span>
        About any model, agent or AI app.
      </span>
    </button>
  );
}

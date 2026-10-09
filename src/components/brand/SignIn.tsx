"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "motion/react";
import { ArrowRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { LiveMark, useReduce } from "./LiveMark";

/**
 * The entrance (brand spec §19–23): burgundy, the cream mark revealing itself,
 * then one honest way in. The reveal is full on a first visit (the boot script
 * sets data-reveal) and short afterwards; a click or key skips it. Content is
 * server-rendered and timed with CSS, so it appears without JavaScript too.
 */
export function SignIn() {
  const router = useRouter();
  const reduce = useReduce();
  const [skipped, setSkipped] = useState(false);
  const [leaving, setLeaving] = useState<{ x: number; y: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    router.prefetch("/home");
  }, [router]);

  // Remember the reveal; a click or key press skips it.
  useEffect(() => {
    try {
      localStorage.setItem("diablo.revealed", "1");
    } catch {}
    const root = document.documentElement;
    const skip = () => {
      root.removeAttribute("data-reveal");
      setSkipped(true);
    };
    const done = setTimeout(() => root.removeAttribute("data-reveal"), 2600);
    window.addEventListener("keydown", skip, { once: true });
    window.addEventListener("pointerdown", skip, { once: true });
    return () => {
      clearTimeout(done);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, []);

  // A faint cream light follows the pointer, and the mark leans toward it.
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const sx = useSpring(px, { stiffness: 60, damping: 20 });
  const sy = useSpring(py, { stiffness: 60, damping: 20 });
  const lx = useTransform(sx, (v) => `${v * 100}%`);
  const ly = useTransform(sy, (v) => `${v * 100}%`);
  const light = useMotionTemplate`radial-gradient(900px circle at ${lx} ${ly}, rgb(252 248 239 / 0.055), transparent 55%)`;
  const rotateY = useTransform(sx, [0, 1], [-8, 8]);
  const rotateX = useTransform(sy, [0, 1], [6, -6]);

  const enter = async () => {
    await auth.signIn();
    if (reduce) {
      router.push("/home");
      return;
    }
    const r = button.current?.getBoundingClientRect();
    setLeaving(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: innerWidth / 2, y: innerHeight / 2 });
    setTimeout(() => router.push("/home"), 560);
  };

  return (
    <main
      id="main"
      className="entrance relative grid min-h-dvh place-items-center overflow-hidden bg-burgundy px-4 py-12 text-cream"
      style={{ perspective: 1200 }}
      onPointerMove={(e) => {
        if (reduce) return;
        px.set(e.clientX / window.innerWidth);
        py.set(e.clientY / window.innerHeight);
      }}
    >
      {!reduce && <motion.div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: light }} />}
      {/* Without JavaScript the mark simply appears, finished. */}
      <noscript>
        <style>{`.entrance [data-part=lens],.entrance [data-part=eye]{transform:none!important}.entrance [data-part=crescent]{opacity:1!important}.entrance [data-part=seed],.entrance [data-part=outline]{display:none}`}</style>
      </noscript>
      <div aria-hidden className="entrance-grain pointer-events-none absolute inset-0" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgb(30_0_9/0.5)_100%)]" />

      <div className="relative flex w-full max-w-[400px] flex-col items-center text-center">
        <motion.div style={reduce ? undefined : { rotateX, rotateY, transformStyle: "preserve-3d" }}>
          <LiveMark key={skipped ? "skipped" : "intro"} size={112} intro={skipped ? "none" : "auto"} track blink title={BRAND.name} />
        </motion.div>

        <p className="entrance-name mt-5 text-[12px] font-medium uppercase tracking-[0.22em] text-cream/80">{BRAND.name}</p>

        <div className="entrance-auth flex w-full flex-col items-center">
          <h1 className="mt-8 text-[30px] font-semibold leading-[38px] tracking-[-0.02em]">{BRAND.tagline}</h1>
          <p className="mt-3 text-[15px] leading-6 text-cream/80">
            Research, test, and understand
            <br />
            the AI systems you build.
          </p>

          <motion.button
            ref={button}
            type="button"
            onClick={enter}
            whileTap={reduce ? undefined : { scale: 0.98 }}
            className="group mt-9 flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-cream text-[15px] font-medium text-burgundy shadow-[0_12px_32px_-12px_rgb(0_0_0/0.55)] transition-colors duration-150 hover:bg-white focus-visible:outline-cream"
          >
            Enter demo workspace
            <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2} />
          </motion.button>
          <p className="mt-3 text-[13px] text-cream/80">Sign-in is not available in this demo.</p>

          <p className="mt-10 max-w-[340px] text-[12px] leading-[18px] text-cream/80">
            By continuing you agree to the{" "}
            <Link href="/legal/terms" className="text-cream underline underline-offset-2 hover:text-white">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="text-cream underline underline-offset-2 hover:text-white">
              Privacy Policy
            </Link>
            .
          </p>
          <p className="mt-2 text-[12px] text-cream/80">
            <Link href="/legal/usage" className="underline underline-offset-2 hover:text-white">
              Usage Policy
            </Link>
          </p>
        </div>
      </div>

      {/* Burgundy → warm off-white: the app grows out of the button you pressed. */}
      <AnimatePresence>
        {leaving && (
          <motion.div
            aria-hidden
            className="fixed inset-0 z-50 bg-bg"
            initial={{ clipPath: `circle(0px at ${leaving.x}px ${leaving.y}px)` }}
            animate={{ clipPath: `circle(150vmax at ${leaving.x}px ${leaving.y}px)` }}
            transition={{ duration: 0.6, ease: [0.65, 0, 0.35, 1] }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

"use client";

import { motion, useReducedMotion } from "motion/react";
import { spring } from "@/lib/motion";

/** Settles into place the first time it scrolls into view. Reduced motion: a plain fade. */
export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li" | "section";
}) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={reduce ? { duration: 0.2, delay } : { ...spring(1, 0.6), delay }}
    >
      {children}
    </Tag>
  );
}

/** A section's heading block. */
export function SectionHead({
  eyebrow,
  title,
  children,
  className = "",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Reveal className={`max-w-2xl ${className}`}>
      {eyebrow && <p className="t-overline mb-4 text-accent-text">{eyebrow}</p>}
      <h2 className="t-title text-balance">{title}</h2>
      {children && <p className="t-lead mt-5 text-pretty text-ink-2">{children}</p>}
    </Reveal>
  );
}

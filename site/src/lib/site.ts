/** The product itself. Every "Try yourself" goes here. */
export const APP_URL = "https://diablo.pnoia.dev";

export const SITE = {
  name: "Diablo",
  company: "Diablo AI",
  tagline: "AI that evolves AI.",
  description:
    "Diablo investigates AI systems: it forms hypotheses, runs controlled experiments and turns what it finds into knowledge you can trust.",
} as const;

/** Named for what is behind them. The mark is the way home. */
export const NAV = [
  { href: "/about", label: "About" },
  { href: "/team", label: "Team" },
  { href: "/pricing", label: "Pricing" },
] as const;

/** The product itself. Every "Try yourself" goes here. */
export const APP_URL = "https://diablo.pnoia.dev";

export const SITE = {
  name: "Diablo",
  company: "Diablo AI",
  tagline: "AI that evolves AI.",
  description:
    "Diablo AI shows companies what is actually happening inside their AI systems: which change moved a score, and how sure they can be.",
} as const;

/** Named for what is behind them. The mark is the way home. */
export const NAV = [
  { href: "/about", label: "About" },
  { href: "/team", label: "Team" },
  { href: "/pricing", label: "Pricing" },
] as const;

import { BookOpen, Cpu, Database, FileText, FlaskConical, House, Microscope, Settings, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

/**
 * Sidebar navigation, following the brand spec (§6): a short primary list,
 * a quieter secondary list, then the investigations themselves. Navigation is
 * an open decision; keep it in this one place.
 */
export const HOME: NavItem = { href: "/home", label: "Home", icon: House };
export const INVESTIGATIONS: NavItem = { href: "/investigations", label: "Investigations", icon: Microscope };

export const PRIMARY: NavItem[] = [
  HOME,
  INVESTIGATIONS,
  { href: "/systems", label: "AI systems", icon: Cpu },
  { href: "/experiments", label: "Experiments", icon: FlaskConical },
  { href: "/evidence", label: "Evidence", icon: BookOpen },
  { href: "/reports", label: "Reports", icon: FileText },
];

export const SECONDARY: NavItem[] = [
  { href: "/datasets", label: "Datasets", icon: Database },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Everything after Home and Investigations: the library pages. */
export const LIBRARY: NavItem[] = [...PRIMARY.slice(2), SECONDARY[0]];

export const LEGAL = [
  { href: "/legal/terms", label: "Terms of Service", short: "Terms" },
  { href: "/legal/privacy", label: "Privacy Policy", short: "Privacy" },
  { href: "/legal/usage", label: "Usage Policy", short: "Usage policy" },
] as const;

export const PAGE_TITLES: Record<string, string> = {
  "/home": "Home",
  "/investigations": "Investigations",
  "/systems": "AI systems",
  "/experiments": "Experiments",
  "/datasets": "Datasets",
  "/evidence": "Evidence",
  "/reports": "Reports",
  "/settings": "Settings",
  "/design": "Design system",
};

export const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

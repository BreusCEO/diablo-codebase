"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense } from "react";
import { PanelLeft, Plus, Search } from "lucide-react";
import { LayoutGroup, motion } from "motion/react";
import { LiveMark } from "@/components/brand/LiveMark";
import { IconButton } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { ModKey } from "@/components/ui/primitives";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { setSidebarCollapsed, useSidebarCollapsed } from "@/lib/prefs";
import { ui } from "@/lib/ui";
import { AccountMenu, AccountMenuSkeleton } from "./AccountMenu";
import { INVESTIGATIONS, isActive, PRIMARY, SECONDARY, type NavItem } from "./nav";


/**
 * Sidebar content, shared by the desktop sidebar and the mobile drawer.
 * Expanded or collapsed is decided by an attribute on <html> set before
 * first paint; labels hide through CSS, so the server HTML is already right.
 */
export function SidebarContent({ variant, onNavigate }: { variant: "desktop" | "drawer"; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const collapsedPref = useSidebarCollapsed();
  const collapsed = variant === "desktop" && collapsedPref;
  // In the drawer, everything is always expanded.
  const exp = variant === "desktop" ? "sb-expanded" : "";
  const col = variant === "desktop" ? "sb-collapsed" : "hidden";

  const newInvestigation = () => {
    onNavigate?.();
    router.push("/home?new=1");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Brand and collapse */}
      <div className={cn("flex h-12 shrink-0 items-center gap-2 px-3", variant === "desktop" && "[html[data-sidebar=collapsed]_&]:justify-center [html[data-sidebar=collapsed]_&]:px-0")}>
        <Link
          href="/home"
          onClick={onNavigate}
          aria-label={`${BRAND.name}, home`}
          className={cn("flex min-w-0 items-center gap-2 rounded-[6px] px-1 py-1 text-ink", col === "sb-collapsed" && "[html[data-sidebar=collapsed]_&]:hidden")}
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-[7px] bg-burgundy text-cream shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]">
            <LiveMark size={19} track blink />
          </span>
          <span className={cn("truncate text-[14px] font-medium", exp)}>{BRAND.name}</span>
        </Link>
        {variant === "desktop" && (
          <IconButton
            className="ml-auto"
            label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            tooltipSide="right"
            icon={<PanelLeft strokeWidth={1.5} />}
            aria-expanded={!collapsed}
            onClick={() => setSidebarCollapsed(!collapsedPref)}
          />
        )}
      </div>

      <nav aria-label="Primary" className="flex min-h-0 flex-1 flex-col">
        <ul className="space-y-px px-2">
          <li>
            <Row label="New investigation" icon={<Plus strokeWidth={1.5} />} onClick={newInvestigation} collapsed={collapsed} />
          </li>
          <li>
            <Row
              label="Search"
              icon={<Search strokeWidth={1.5} />}
              onClick={() => {
                onNavigate?.();
                ui.setPalette(true);
              }}
              collapsed={collapsed}
              trailing={<ModKey k="K" className={exp} />}
            />
          </li>
        </ul>

        <LayoutGroup id={`nav-${variant}`}>
          <ul className="mt-3 space-y-px px-2" aria-label="Sections">
            {PRIMARY.map((item) => (
              <li key={item.href}>
                <NavRow
                  item={item}
                  // The workspace highlights its own row in the list below, not "Investigations".
                  active={item.href === INVESTIGATIONS.href ? pathname === item.href : isActive(pathname, item.href)}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                  variant={variant}
                />
              </li>
            ))}
          </ul>
        </LayoutGroup>

        <div className={cn("flex-1", exp)} />
        <div className={cn("flex-1", col)} />
        <LayoutGroup id={`nav-secondary-${variant}`}>
          <ul className="space-y-px border-t border-line px-2 py-2" aria-label="More">
            {SECONDARY.map((item) => (
              <li key={item.href}>
                <NavRow item={item} active={isActive(pathname, item.href)} collapsed={collapsed} onNavigate={onNavigate} variant={variant} />
              </li>
            ))}
          </ul>
        </LayoutGroup>
      </nav>

      <div className="shrink-0 border-t border-line p-2">
        <Suspense fallback={<AccountMenuSkeleton collapsed={collapsed} />}>
          <AccountMenu collapsed={collapsed} onNavigate={onNavigate} />
        </Suspense>
      </div>
    </div>
  );
}

const rowClass = (active: boolean) =>
  cn(
    "group relative flex h-8 w-full items-center gap-2.5 rounded-[6px] px-2 text-left text-[14px] transition-colors duration-150",
    "[&>svg]:relative [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-ink-3",
    "[html[data-sidebar=collapsed]_.sidebar_&]:justify-center [html[data-sidebar=collapsed]_.sidebar_&]:px-0",
    active ? "font-medium text-accent-text [&>svg]:text-accent-text" : "text-ink-2 hover:bg-sunken/70 hover:text-ink",
  );

/** The active row's burgundy wash glides between rows (brand spec §6: a subtle tint, not a pill). */
function ActiveWash({ id }: { id: string }) {
  return (
    <motion.span
      layoutId={id}
      aria-hidden
      transition={{ type: "spring", stiffness: 520, damping: 40, mass: 0.7 }}
      className="absolute inset-0 rounded-[6px] bg-accent-tint ring-1 ring-inset ring-accent-tint-2"
    />
  );
}

function Row({
  label,
  icon,
  onClick,
  collapsed,
  trailing,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  collapsed: boolean;
  trailing?: React.ReactNode;
}) {
  const btn = (
    <button type="button" onClick={onClick} className={rowClass(false)}>
      {icon}
      <span className="flex-1 truncate [html[data-sidebar=collapsed]_.sidebar_&]:sr-only">{label}</span>
      {trailing}
    </button>
  );
  return collapsed ? (
    <Tooltip side="right" content={label}>
      {btn}
    </Tooltip>
  ) : (
    btn
  );
}

function NavRow({
  item,
  active,
  collapsed,
  onNavigate,
  variant,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
  variant: "desktop" | "drawer";
}) {
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={rowClass(active)}
    >
      {active && <ActiveWash id={`nav-active-${variant}`} />}
      <Icon strokeWidth={active ? 2 : 1.5} />
      <span className="relative truncate [html[data-sidebar=collapsed]_.sidebar_&]:sr-only">{item.label}</span>
    </Link>
  );
  return collapsed ? (
    <Tooltip side="right" content={item.label}>
      {link}
    </Tooltip>
  ) : (
    link
  );
}

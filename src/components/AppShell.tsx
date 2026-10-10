import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useFeed } from "@/lib/market/binance-feed";

export const NAV = [
  { to: "/", label: "Overview Dashboard" },
  { to: "/heatmap", label: "Live Heatmap" },
  { to: "/spot-perp", label: "Spot vs Perpetual" },
  { to: "/migration", label: "Liquidity Migration" },
  { to: "/integrity", label: "Market Integrity" },
  { to: "/studio", label: "Research Studio" },
  { to: "/regulatory", label: "Regulatory Research" },
  { to: "/assistant", label: "AI Research Assistant" },
  { to: "/methodology", label: "Methodology & About" },
] as const;

export function StatusPill() {
  const { status } = useFeed();
  const tone = status === "live" ? "bg-live" : status === "stale" || status.includes("sync") || status === "connecting" ? "bg-warn" : "bg-destructive";
  return (
    <span className="inline-flex items-center gap-2 rounded-sm border px-2 py-1 font-mono text-xs">
      <span className={`h-2 w-2 rounded-full ${tone} ${status === "live" ? "animate-pulse" : ""}`} />
      LIVE FEED · {status.toUpperCase()}
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:block">
          <Link to="/" className="block">
            <div className="font-mono text-lg font-bold tracking-tight text-primary">FZ HMI</div>
            <div className="text-xs text-muted-foreground">Fz Heat Map Intelligence</div>
          </Link>
          <div className="md:mt-3"><StatusPill /></div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: true }}
              className="whitespace-nowrap rounded-sm px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              activeProps={{ className: "bg-accent text-foreground border-l-2 border-primary" }}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden px-4 pt-4 text-xs text-muted-foreground md:block">Founder & researcher<br /><span className="text-foreground">Faizan Rehan</span></div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}

export function PageHeader({ title, sub, badge }: { title: string; sub: string; badge?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{sub}</p>
      </div>
      {badge}
    </header>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string | undefined; tone?: "bid" | "ask" | undefined }) {
  return (
    <div className="panel p-3">
      <div className="label-caps">{label}</div>
      <div className={`mt-1 font-mono text-xl ${tone === "bid" ? "text-bid" : tone === "ask" ? "text-ask" : ""}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export type FeatureStatus = "Implemented" | "Tested" | "In Progress" | "Planned";
export function StatusBadge({ s }: { s: FeatureStatus }) {
  const c = s === "Tested" ? "text-live border-live" : s === "Implemented" ? "text-bid border-bid" : s === "In Progress" ? "text-warn border-warn" : "text-muted-foreground";
  return <span className={`rounded-sm border px-2 py-0.5 font-mono text-[0.68rem] uppercase ${c}`}>{s}</span>;
}

export function PlannedModule({ title, sub, stage, items, note }: { title: string; sub: string; stage: number; items: string[]; note?: string | undefined }) {
  return (
    <>
      <PageHeader title={title} sub={sub} badge={<StatusBadge s="Planned" />} />
      <div className="panel p-5">
        <div className="label-caps">Development stage {stage} — not yet implemented</div>
        <p className="mt-2 text-sm text-muted-foreground">This module has no working analysis yet. No data or results are shown here so nothing can be mistaken for real findings.</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {items.map((i) => <li key={i} className="rounded-sm border px-3 py-2 text-sm">{i}</li>)}
        </ul>
        {note && <p className="mt-4 text-xs text-warn">{note}</p>}
      </div>
    </>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatusBadge, type FeatureStatus } from "@/components/AppShell";
import { SOURCE } from "@/lib/market/binance-feed";

export const Route = createFileRoute("/methodology")({
  head: () => ({ meta: [
    { title: "Methodology & About · Fz Heat Map Intelligence" },
    { name: "description", content: "Data sources, reconstruction method, limitations and feature-status register of FZ HMI." },
    { property: "og:title", content: "Methodology & About · FZ HMI" },
    { property: "og:description", content: "How Fz Heat Map Intelligence sources and reconstructs order-book data." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Methodology,
});

const REGISTER: [string, number, FeatureStatus][] = [
  ["Branding, navigation, responsive layout", 1, "Implemented"],
  ["Overview dashboard (live metrics only)", 1, "Implemented"],
  ["Binance snapshot + diff-depth reconstruction", 2, "Tested"],
  ["Sequence-gap resync, stale & invalid detection", 2, "Tested"],
  ["Reconnection with exponential backoff", 2, "Implemented"],
  ["Live price-vs-time heatmap, zoom, window, depth inspector", 2, "Implemented"],
  ["Session CSV export (browser buffer)", 2, "Implemented"],
  ["Heatmap pan", 2, "Planned"],
  ["Permanent historical recording", 3, "Implemented"],
  ["Historical replay & annotations", 3, "Implemented"],
  ["Spot vs perpetual comparison", 4, "Implemented"],
  ["Liquidity migration research engine", 4, "Implemented"],
  ["Market integrity monitor", 5, "Implemented"],
  ["Research Studio", 5, "Implemented"],
  ["Regulatory research workspace", 6, "Implemented"],
  ["AI research assistant", 6, "Implemented"],
  ["Overview liquidity terminal with trade bubbles", 2, "Implemented"],
  ["Ten-issuer ETF flows × news research", 6, "In Progress"],
  ["Legal reference and observed-indicator matrix", 6, "Implemented"],
  ["Alternative-explanation evidence assessment", 5, "Tested"],
  ["Two simulated reviewer studies", 5, "Tested"],
  ["SHA-256 evidence bundles and verification", 5, "Tested"],
  ["Research-only STOR / academic memorandum exports", 6, "Implemented"],
];

function Methodology() {
  return (
    <>
      <PageHeader title="Methodology & About" sub="Fz Heat Map Intelligence (FZ HMI) — an independent research tool for crypto order-book microstructure, liquidity migration, technological asymmetry and market transparency. Founder and researcher: Faizan Rehan." />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-4 text-sm">
          <div className="label-caps mb-2">Data source</div>
          <p>{SOURCE.exchange} public, read-only market data (no API key, no trading). Snapshot: <code className="break-all font-mono text-xs">{SOURCE.rest}</code>. Stream: <code className="break-all font-mono text-xs">{SOURCE.ws}</code>.</p>
          <div className="label-caps mb-2 mt-4">Reconstruction</div>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Open the diff-depth stream and buffer events.</li>
            <li>Fetch a 1000-level REST snapshot.</li>
            <li>Discard events with final id ≤ snapshot id; the first applied event must bridge snapshot id + 1.</li>
            <li>Each later event must start exactly at the previous final id + 1; otherwise the book is rebuilt.</li>
            <li>Malformed numbers are rejected; quantity 0 removes a level.</li>
          </ol>
          <div className="label-caps mb-2 mt-4">Limitations</div>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Displayed liquidity is not intent; orders can be cancelled at any time.</li>
            <li>Only the top 1000 levels per side are visible; far levels may be incomplete.</li>
            <li>One exchange only — not the whole market.</li>
            <li>Timestamps are the browser's receive time (UTC); clocks can drift.</li>
            <li>Live history is tab-only; signed-in users can record depth sessions permanently. Trade bubbles are not included in depth recordings.</li>
          </ul>
        </section>
        <section className="panel p-4">
          <div className="label-caps mb-2">Feature-status register</div>
          <table className="w-full text-sm">
            <tbody>
              {REGISTER.map(([f, s, st]) => (
                <tr key={f} className="border-b last:border-0">
                  <td className="py-1.5 pr-2">{f}</td>
                  <td className="py-1.5 font-mono text-xs text-muted-foreground">S{s}</td>
                  <td className="py-1.5 text-right"><StatusBadge s={st} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">No academic publication, external validation or institutional adoption is claimed.</p>
        </section>
      </div>
    </>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, Stat, StatusBadge } from "@/components/AppShell";
import { ParamsEditor, SourcePicker, useDataSource } from "@/components/DataSource";
import { DEFAULT_PARAMS, detectEvents, download, eventsCSV, summarise, ANALYSIS_VERSION } from "@/lib/market/analysis";
import { EvidenceWorkbench } from "@/components/EvidenceWorkbench";

export const Route = createFileRoute("/integrity")({
  head: () => ({ meta: [
    { title: "Market Integrity · Fz Heat Map Intelligence" },
    { name: "description", content: "Potential spoofing indicators: short-lived large orders and repeated appear/disappear cycles, with thresholds and limitations." },
    { property: "og:title", content: "Market Integrity · FZ HMI" },
    { property: "og:description", content: "Transparent, threshold-based potential spoofing indicators on BTC order-book data." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: IntegrityPage,
});

function IntegrityPage() {
  const ds = useDataSource();
  const [p, setP] = useState({ ...DEFAULT_PARAMS, minQty: 10 });
  const events = useMemo(() => detectEvents(ds.columns, p), [ds.columns, p, ds.isLive ? ds.tick : 0]);
  const sum = useMemo(() => summarise(ds.columns, events), [events]);
  const alerts = events.filter((e) => e.type === "short_lived").reverse();
  const withdrawn = sum.counts.withdrawn, consumed = sum.counts.consumed;
  const ratio = withdrawn + consumed ? withdrawn / (withdrawn + consumed) : null;

  return (
    <>
      <PageHeader title="Market Integrity" sub="Flags order-book patterns that researchers associate with spoofing. Every alert is a potential indicator for further study, never proof of fraud or intent." badge={<StatusBadge s="Implemented" />} />
      <div className="panel mb-4 space-y-3 p-3"><SourcePicker ds={ds} /><ParamsEditor p={p} onChange={setP} /></div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Short-lived large orders" value={alerts.length} hint={`≥${p.minQty} BTC, lived ≤${p.shortLivedMax}s, never reached`} tone={alerts.length ? "ask" : undefined} />
        <Stat label="Flickering levels" value={sum.flickerLevels.length} hint="≥3 add/withdraw cycles" />
        <Stat label="Withdrawn share" value={ratio === null ? "n/a" : `${(ratio * 100).toFixed(0)}%`} hint={`withdrawn ${withdrawn} vs consumed ${consumed}`} />
        <Stat label="Window" value={`${sum.seconds.toFixed(0)} s`} hint={`${sum.gaps} data gaps`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="panel p-3">
          <div className="mb-2 flex items-center justify-between"><div className="label-caps">Potential spoofing indicators</div>
            <button disabled={!alerts.length} onClick={() => download(`fzhmi_integrity_${Date.now()}.csv`, `# ${JSON.stringify({ software: ANALYSIS_VERSION, params: p, source: ds.sel })}\n${eventsCSV(alerts)}`, "text/csv")} className="rounded-sm border px-2 py-1 text-xs disabled:opacity-40">Export</button></div>
          {!alerts.length ? <p className="py-6 text-center text-xs text-muted-foreground">No alerts under the current thresholds.</p> :
            <ul className="max-h-[420px] space-y-2 overflow-auto">{alerts.slice(0, 100).map((a) => (
              <li key={a.id} className="rounded-sm border p-2 text-xs">
                <div className="font-mono"><span className={a.side === "bid" ? "text-bid" : "text-ask"}>{a.side.toUpperCase()}</span> {a.qty.toFixed(1)} BTC @ {a.price} · {new Date(a.t).toISOString().slice(11, 19)} UTC</div>
                <div className="mt-1 text-muted-foreground">Supporting data: size {a.before.toFixed(1)}→{a.after.toFixed(1)} BTC, lived {a.lifetime?.toFixed(0)}s, ${Math.abs(a.distance).toFixed(0)} from mid. Linked event {a.relatedId}.</div>
                <div className="mt-1 text-muted-foreground">Other explanations: a market maker updating quotes, risk limits, latency arbitrage, or a pre-planned order being cancelled.</div>
              </li>))}</ul>}
        </div>
        <div className="panel p-3">
          <div className="label-caps mb-2">Repeated appear/disappear cycles</div>
          {!sum.flickerLevels.length ? <p className="py-6 text-center text-xs text-muted-foreground">No level reached 3 cycles.</p> :
            <table className="w-full font-mono text-xs"><thead className="text-left text-muted-foreground"><tr><th>Side</th><th className="text-right">Price</th><th className="text-right">Cycles</th></tr></thead>
              <tbody>{sum.flickerLevels.map((f) => <tr key={f.side + f.price} className="border-t"><td className={f.side === "bid" ? "text-bid" : "text-ask"}>{f.side}</td><td className="text-right">{f.price}</td><td className="text-right">{f.cycles}</td></tr>)}</tbody></table>}
        </div>
      </div>

      <EvidenceWorkbench />
      <div className="panel mt-4 p-3 text-xs text-muted-foreground">
        <div className="label-caps mb-1 text-foreground">Limitations</div>
        <ul className="list-disc space-y-1 pl-4">
          <li>Data is one exchange (Binance spot), sampled once per second in $10 buckets. Patterns faster than one second are missed.</li>
          <li>Trades are not matched yet, so depth is not compared with what was actually executed.</li>
          <li>The data doesn't show who placed orders or why. Intent, which legal definitions of spoofing require, can't be judged from this data.</li>
        </ul>
      </div>
    </>
  );
}

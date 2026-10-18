import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, Stat, StatusBadge } from "@/components/AppShell";
import { ParamsEditor, SourcePicker, useDataSource } from "@/components/DataSource";
import { EtfNewsPanel } from "@/components/EtfNewsPanel";
import { ANALYSIS_VERSION, DEFAULT_PARAMS, detectEvents, download, eventsCSV, summarise, type EventType } from "@/lib/market/analysis";

export const Route = createFileRoute("/migration")({
  head: () => ({ meta: [
    { title: "Liquidity Migration · Fz Heat Map Intelligence" },
    { name: "description", content: "Detect added, consumed, withdrawn and possibly relocated BTC order-book liquidity with configurable, exportable rules." },
    { property: "og:title", content: "Liquidity Migration · FZ HMI" },
    { property: "og:description", content: "Rule-based liquidity event detection on live or recorded order-book sessions." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: MigrationPage,
});

const LABEL: Record<EventType, string> = { added: "Added", consumed: "Consumed (near price)", withdrawn: "Withdrawn (away from price)", possible_relocation: "Possible relocation", short_lived: "Short-lived" };

function MigrationPage() {
  const ds = useDataSource();
  const [p, setP] = useState(DEFAULT_PARAMS);
  const [filter, setFilter] = useState<EventType | "all">("all");
  // Re-run each tick for the live buffer; once for a saved session.
  const events = useMemo(() => detectEvents(ds.columns, p), [ds.columns, p, ds.isLive ? ds.tick : 0]);
  const sum = useMemo(() => summarise(ds.columns, events), [events]);
  const shown = events.filter((e) => filter === "all" || e.type === filter).slice(-300).reverse();
  const meta = { software: ANALYSIS_VERSION, source: ds.sel, generated_utc: new Date().toISOString(), params: p };

  return (
    <>
      <PageHeader title="Liquidity Migration" sub="Tracks where displayed liquidity is added, consumed, withdrawn, or reappears at another price. Rules are configurable and every event can be exported with the exact parameters used." badge={<StatusBadge s="Tested" />} />
      <div className="panel mb-4 space-y-3 p-3"><SourcePicker ds={ds} /><ParamsEditor p={p} onChange={setP} /></div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Analysed" value={`${sum.seconds.toFixed(0)} s`} hint={`${sum.columns} columns · ${sum.gaps} gaps`} />
        {(Object.keys(LABEL) as EventType[]).map((t) => <Stat key={t} label={LABEL[t]} value={sum.counts[t]} hint={sum.counts[t] ? `mean ${sum.meanSize[t].toFixed(2)} BTC` : "n = 0"} tone={t === "added" ? "bid" : t === "withdrawn" ? "ask" : undefined} />)}
      </div>

      <div className="panel mt-4 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {(["all", ...Object.keys(LABEL)] as const).map((t) => (
              <button key={t} onClick={() => setFilter(t as EventType | "all")} className={`rounded-sm border px-2 py-1 text-xs ${filter === t ? "border-primary text-primary" : "text-muted-foreground"}`}>{t === "all" ? "All" : LABEL[t as EventType]}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <button disabled={!events.length} onClick={() => download(`fzhmi_events_${Date.now()}.csv`, `# ${JSON.stringify(meta)}\n${eventsCSV(events)}`, "text/csv")} className="rounded-sm border px-2 py-1 text-xs hover:bg-accent disabled:opacity-40">Export CSV</button>
            <button disabled={!events.length} onClick={() => download(`fzhmi_events_${Date.now()}.json`, JSON.stringify({ meta, summary: sum, events }, null, 2), "application/json")} className="rounded-sm border px-2 py-1 text-xs hover:bg-accent disabled:opacity-40">Export JSON</button>
          </div>
        </div>
        {ds.columns.length < 2 ? <p className="py-6 text-center text-xs text-muted-foreground">Not enough data yet. The live buffer fills at one column per second.</p>
          : !shown.length ? <p className="py-6 text-center text-xs text-muted-foreground">No events match these rules. Try lowering the size threshold.</p>
          : <div className="max-h-[520px] overflow-auto">
            <table className="w-full min-w-[720px] font-mono text-xs">
              <thead className="sticky top-0 bg-card text-left text-muted-foreground"><tr><th className="py-1">ID</th><th>Time UTC</th><th>Type</th><th>Side</th><th className="text-right">Price</th><th className="text-right">Δ BTC</th><th className="text-right">From→To</th><th className="text-right">Dist $</th><th className="pl-3">Note</th></tr></thead>
              <tbody>{shown.map((e) => (
                <tr key={e.id} className="border-t align-top">
                  <td className="py-1">{e.id}</td><td>{new Date(e.t).toISOString().slice(11, 19)}</td><td>{LABEL[e.type]}</td>
                  <td className={e.side === "bid" ? "text-bid" : "text-ask"}>{e.side}</td>
                  <td className="text-right">{e.price}{e.toPrice ? ` → ${e.toPrice}` : ""}</td>
                  <td className="text-right">{e.qty.toFixed(2)}</td>
                  <td className="text-right">{e.before.toFixed(1)}→{e.after.toFixed(1)}</td>
                  <td className="text-right">{e.distance.toFixed(0)}</td>
                  <td className="pl-3 font-sans text-muted-foreground">{e.note}</td>
                </tr>))}</tbody>
            </table></div>}
      </div>

      <EtfNewsPanel />
      <div className="panel mt-4 p-3 text-xs text-muted-foreground">
        <div className="label-caps mb-1 text-foreground">Method & limitations</div>
        <ul className="list-disc space-y-1 pl-4">
          <li>Input: Binance spot depth aggregated into $10 buckets, sampled once per second. Changes inside a second are invisible.</li>
          <li>“Consumed” means size fell while the best quote was at or through the level. Trades are not yet matched, so this is not confirmed execution.</li>
          <li>“Possible relocation” only means a similar size appeared at another price soon after. It is not evidence of the same order or participant. Liquidity Destination Theory is treated as a hypothesis to test.</li>
          <li>Version {ANALYSIS_VERSION}. The same session with the same settings always gives the same events.</li>
        </ul>
      </div>
    </>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, StatusPill } from "@/components/AppShell";
import { Heatmap } from "@/components/Heatmap";
import { BUCKET, SOURCE, exportColumnsCSV, useFeed } from "@/lib/market/binance-feed";
import { useRecorder } from "@/lib/market/recorder";

export const Route = createFileRoute("/heatmap")({
  head: () => ({ meta: [
    { title: "Live Heatmap · Fz Heat Map Intelligence" },
    { name: "description", content: "Live BTC/USDT order-book liquidity heatmap reconstructed from Binance snapshots and diff-depth updates." },
    { property: "og:title", content: "Live BTC/USDT Order-Book Heatmap" },
    { property: "og:description", content: "Price-versus-time liquidity heatmap from authentic exchange data." },
  ] }),
  component: HeatmapPage,
});

const RANGES = [250, 500, 1000, 1500];
const WINDOWS = [{ s: 60, l: "1m" }, { s: 180, l: "3m" }, { s: 300, l: "5m" }, { s: 600, l: "10m" }];

function HeatmapPage() {
  const f = useFeed();
  const rec = useRecorder();
  const [range, setRange] = useState(500);
  const [secs, setSecs] = useState(180);
  const bids = [...f.book.bids].sort((a, b) => b[0] - a[0]).slice(0, 12);
  const asks = [...f.book.asks].sort((a, b) => a[0] - b[0]).slice(0, 12).reverse();
  const btn = (on: boolean) => `rounded-sm border px-2 py-1 font-mono text-xs ${on ? "border-primary text-primary" : "text-muted-foreground"}`;

  return (
    <>
      <PageHeader title="Live Heatmap — BTC/USDT" sub={`Displayed liquidity in $${BUCKET} buckets, sampled once per second. Teal = bid-dominant, red = ask-dominant, amber line = mid price.`} badge={<StatusPill />} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="label-caps">Zoom ±$</span>
        {RANGES.map((r) => <button key={r} className={btn(range === r)} onClick={() => setRange(r)}>{r}</button>)}
        <span className="label-caps ml-2">Window</span>
        {WINDOWS.map((w) => <button key={w.s} className={btn(secs === w.s)} onClick={() => setSecs(w.s)}>{w.l}</button>)}
        <button
          className={`ml-auto rounded-sm px-3 py-1 font-mono text-xs ${rec.recording ? "bg-destructive text-destructive-foreground" : "border border-live text-live"}`}
          onClick={() => (rec.recording ? rec.stop() : rec.start())}
        >
          {rec.recording ? `■ Stop recording (${rec.savedCount} saved)` : "● Record session"}
        </button>
        <button className="rounded-sm bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-40" disabled={!f.columns.length} onClick={() => exportColumnsCSV(f.columns, range)}>Export session CSV</button>
      </div>
      {rec.error && <div className="mb-3 rounded-sm border border-destructive px-3 py-2 text-xs text-destructive">Recording error: {rec.error}</div>}
      {f.status === "stale" && <div className="mb-3 rounded-sm border border-warn px-3 py-2 text-xs text-warn">No messages for over 5 seconds — data shown may be out of date.</div>}
      <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
        <Heatmap columns={f.columns} range={range} seconds={secs} tick={f.tick} />
        <div className="panel p-3 font-mono text-xs">
          <div className="label-caps mb-2">Depth inspector (top 12)</div>
          {asks.map(([p, q]) => <Row key={p} p={p} q={q} side="ask" />)}
          <div className="my-1 border-t" />
          {bids.map(([p, q]) => <Row key={p} p={p} q={q} side="bid" />)}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Source: {SOURCE.exchange} public stream, reconstructed with sequence checks (gaps trigger a fresh snapshot). The live buffer holds up to 10 minutes in this tab; press “Record session” to store samples permanently in Lovable Cloud, then replay them in the <Link to="/archive" className="text-primary underline">Session Archive</Link>.
      </p>
    </>
  );
}

function Row({ p, q, side }: { p: number; q: number; side: "bid" | "ask" }) {
  return <div className="flex justify-between"><span className={side === "bid" ? "text-bid" : "text-ask"}>{p.toFixed(2)}</span><span>{q.toFixed(5)}</span></div>;
}

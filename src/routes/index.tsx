import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, Stat, StatusPill } from "@/components/AppShell";
import { SOURCE, useFeed } from "@/lib/market/binance-feed";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Overview Dashboard · Fz Heat Map Intelligence" },
    { name: "description", content: "Live BTC/USDT order-book status, depth and data freshness from Binance public market data." },
    { property: "og:title", content: "Fz Heat Map Intelligence — Overview" },
    { property: "og:description", content: "Crypto order-book liquidity research dashboard by Faizan Rehan." },
  ] }),
  component: Dashboard,
});

const fmt = (n: number | null | undefined, d = 2) => (n == null ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));

function Dashboard() {
  const f = useFeed();
  const live = f.status === "live" || f.status === "stale";
  const b = live ? f.book.bestBid() : null, a = live ? f.book.bestAsk() : null;
  const d05 = live ? f.book.depthWithin(0.5) : null, d1 = live ? f.book.depthWithin(1) : null;
  const imb = d05 && d05.bid + d05.ask > 0 ? (d05.bid - d05.ask) / (d05.bid + d05.ask) : null;
  const age = f.lastMessageAt ? (Date.now() - f.lastMessageAt) / 1000 : null;
  // Concentration: share of ±1% depth held by the largest 5 $10 buckets.
  let conc: number | null = null;
  const last = f.columns.at(-1);
  if (last) {
    const qs = [...last.levels].filter(([p]) => Math.abs(p - last.mid) <= last.mid * 0.01).map(([, v]) => v.bid + v.ask).sort((x, y) => y - x);
    const tot = qs.reduce((s, q) => s + q, 0); if (tot > 0) conc = qs.slice(0, 5).reduce((s, q) => s + q, 0) / tot;
  }

  return (
    <>
      <PageHeader title="Fz Heat Map Intelligence" sub="Overview of the live BTC/USDT order book reconstructed from Binance public market data. Read-only — no trading." badge={<StatusPill />} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Instrument" value="BTC/USDT" hint={`${SOURCE.exchange} · spot`} />
        <Stat label="Mid price" value={b && a ? `$${fmt((a + b) / 2)}` : "—"} hint={b && a ? `Spread $${fmt(a - b)}` : "Not available until synced"} />
        <Stat label="Bid depth ±0.5%" value={d05 ? `${fmt(d05.bid, 2)} BTC` : "—"} tone="bid" hint={d1 ? `±1%: ${fmt(d1.bid, 1)} BTC` : undefined} />
        <Stat label="Ask depth ±0.5%" value={d05 ? `${fmt(d05.ask, 2)} BTC` : "—"} tone="ask" hint={d1 ? `±1%: ${fmt(d1.ask, 1)} BTC` : undefined} />
        <Stat label="Imbalance ±0.5%" value={imb == null ? "—" : `${(imb * 100).toFixed(1)}%`} hint="(bid−ask)/(bid+ask)" />
        <Stat label="Top-5 bucket concentration" value={conc == null ? "—" : `${(conc * 100).toFixed(1)}%`} hint="Share of ±1% depth in 5 largest $10 levels" />
        <Stat label="Data freshness" value={age == null ? "—" : `${age.toFixed(1)}s`} hint={age != null && age > 5 ? "Stale — data may be out of date" : "Since last WebSocket message"} />
        <Stat label="Session" value={`${f.columns.length}s`} hint={f.sessionStart ? `Browser session since ${new Date(f.sessionStart).toISOString().slice(11, 19)}Z · not persisted` : undefined} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="panel p-4 lg:col-span-2">
          <div className="label-caps mb-2">Latest feed events</div>
          <ul className="max-h-72 space-y-1 overflow-auto font-mono text-xs">
            {f.events.length === 0 && <li className="text-muted-foreground">No events yet.</li>}
            {f.events.slice(0, 40).map((e, i) => (
              <li key={i} className={e.kind === "error" ? "text-destructive" : e.kind === "warn" ? "text-warn" : "text-muted-foreground"}>
                {new Date(e.t).toISOString().slice(11, 23)}Z {e.text}
              </li>
            ))}
          </ul>
        </section>
        <section className="panel p-4 text-sm">
          <div className="label-caps mb-2">Source & integrity</div>
          <dl className="space-y-1 font-mono text-xs">
            <div>Exchange: {SOURCE.exchange}</div>
            <div className="break-all">Stream: {SOURCE.ws}</div>
            <div>lastUpdateId: {f.lastUpdateId || "—"}</div>
            <div>Updates applied: {f.stats.applied}</div>
            <div>Stale dropped: {f.stats.stale}</div>
            <div>Sequence gaps: {f.stats.gaps}</div>
            <div>Invalid: {f.stats.invalid}</div>
            <div>Snapshots / reconnects: {f.stats.snapshots} / {f.stats.reconnects}</div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">All figures are computed from the live feed. Nothing here is simulated. Permanent recording isn't set up yet — see <Link to="/methodology" className="text-primary underline">feature status</Link>.</p>
        </section>
      </div>
    </>
  );
}

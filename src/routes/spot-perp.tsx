import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PageHeader, StatusBadge } from "@/components/AppShell";
import { FUNDING_SOURCES, VENUES, basisBps, l1Imbalance, mid, type Funding, type Quote } from "@/lib/market/venues";
import { DualHeatmap } from "@/components/DualHeatmap";

export const Route = createFileRoute("/spot-perp")({
  head: () => ({ meta: [
    { title: "Spot vs Perpetual · Fz Heat Map Intelligence" },
    { name: "description", content: "Live BTC spot vs perpetual comparison across Binance, Bybit and OKX: basis, spreads, imbalance and funding." },
    { property: "og:title", content: "Spot vs Perpetual · FZ HMI" },
    { property: "og:description", content: "Live cross-exchange spot vs perpetual basis, spreads and funding rates." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: SpotPerp,
});

type VStatus = "connecting" | "live" | "stale" | "down";
interface VState { quote: Quote | null; at: number | null; status: VStatus; msgs: number }
const EXCH = ["Binance", "Bybit", "OKX"] as const;
const HISTORY = 300;

function useVenues() {
  const state = useRef<Record<string, VState>>(Object.fromEntries(VENUES.map((v) => [v.id, { quote: null, at: null, status: "connecting", msgs: 0 }])));
  const history = useRef<{ t: number; basis: Record<string, number | null> }[]>([]);
  const [, setTick] = useState(0);

  useEffect(() => {
    let closed = false;
    const cleanups: (() => void)[] = [];
    for (const v of VENUES) {
      let ws: WebSocket | null = null, retry = 0, ping: ReturnType<typeof setInterval> | undefined, timer: ReturnType<typeof setTimeout> | undefined;
      const s = state.current[v.id]!;
      const connect = () => {
        s.status = "connecting";
        try { ws = new WebSocket(v.ws); } catch { s.status = "down"; return; }
        ws.onopen = () => { retry = 0; if (v.subscribe) ws!.send(v.subscribe); if (v.ping) ping = setInterval(() => ws?.readyState === 1 && ws.send(v.ping!.payload), v.ping.every); };
        ws.onmessage = (m) => {
          if (m.data === "pong") return;
          let j: unknown; try { j = JSON.parse(m.data); } catch { return; }
          const q = v.parse(j); if (!q) return;
          s.quote = q; s.at = Date.now(); s.status = "live"; s.msgs++;
        };
        ws.onclose = () => { clearInterval(ping); if (closed) return; s.status = "down"; timer = setTimeout(connect, Math.min(30000, 1000 * 2 ** retry++)); };
      };
      connect();
      cleanups.push(() => { clearInterval(ping); clearTimeout(timer); ws?.close(); });
    }
    const iv = setInterval(() => {
      const now = Date.now();
      for (const s of Object.values(state.current)) if (s.status === "live" && s.at && now - s.at > 5000) s.status = "stale";
      const basis: Record<string, number | null> = {};
      for (const e of EXCH) {
        const sp = state.current[`${e.toLowerCase()}-spot`]!, pp = state.current[`${e.toLowerCase()}-perp`]!;
        basis[e] = sp.status === "live" && pp.status === "live" && sp.quote && pp.quote ? basisBps(pp.quote, sp.quote) : null;
      }
      history.current.push({ t: now, basis });
      if (history.current.length > HISTORY) history.current.shift();
      setTick((x) => x + 1);
    }, 1000);
    return () => { closed = true; clearInterval(iv); cleanups.forEach((c) => c()); };
  }, []);
  return { state: state.current, history: history.current };
}

function useFunding() {
  const [rows, setRows] = useState<Record<string, Funding | "error">>({});
  useEffect(() => {
    let alive = true;
    const load = () => FUNDING_SOURCES.forEach(async (f) => {
      try { const r = await fetch(f.url); if (!r.ok) throw 0; const p = f.parse(await r.json()); if (alive) setRows((o) => ({ ...o, [f.exchange]: p ?? "error" })); }
      catch { if (alive) setRows((o) => ({ ...o, [f.exchange]: "error" })); }
    });
    load(); const iv = setInterval(load, 30000);
    return () => { alive = false; clearInterval(iv); };
  }, []);
  return rows;
}

const fmt = (n: number, d = 2) => n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const COLORS: Record<string, string> = { Binance: "var(--ask)", Bybit: "var(--primary)", OKX: "var(--bid)" };

function SpotPerp() {
  const { state, history } = useVenues();
  const funding = useFunding();
  const live = VENUES.filter((v) => state[v.id]!.status === "live" && state[v.id]!.quote);
  const mids = live.map((v) => mid(state[v.id]!.quote!));
  const disp = mids.length > 1 ? ((Math.max(...mids) - Math.min(...mids)) / Math.min(...mids)) * 10000 : null;

  return (
    <>
      <PageHeader title="Spot vs Perpetual" sub="Live BTC top-of-book from three exchanges, spot and perpetual futures side by side. Basis = (perp mid − spot mid) / spot mid, in basis points." badge={<StatusBadge s="Implemented" />} />

      <div className="grid gap-3 sm:grid-cols-3">
        {EXCH.map((e) => {
          const b = history.at(-1)?.basis[e] ?? null;
          return (
            <div key={e} className="panel p-3">
              <div className="label-caps">{e} basis</div>
              <div className={`mt-1 font-mono text-xl ${b === null ? "text-muted-foreground" : b >= 0 ? "text-bid" : "text-ask"}`}>{b === null ? "no data" : `${b >= 0 ? "+" : ""}${fmt(b)} bps`}</div>
              <div className="mt-1 text-xs text-muted-foreground">{b === null ? "Waiting for both spot and perp to be live" : b >= 0 ? "Perp trades above spot (contango)" : "Perp trades below spot (backwardation)"}</div>
            </div>
          );
        })}
      </div>

      <DualHeatmap />

      <div className="panel mt-4 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="label-caps">Basis over last {HISTORY / 60} min (bps)</div>
          <div className="flex gap-3 text-xs">{EXCH.map((e) => <span key={e} className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-sm" style={{ background: COLORS[e] }} />{e}</span>)}</div>
        </div>
        <BasisChart history={history} />
      </div>

      <div className="panel mt-4 overflow-x-auto p-3">
        <div className="label-caps mb-2">Top of book by venue</div>
        <table className="w-full min-w-[640px] font-mono text-xs">
          <thead className="text-muted-foreground"><tr className="text-left">
            <th className="py-1">Venue</th><th>Market</th><th className="text-right">Bid</th><th className="text-right">Ask</th><th className="text-right">Mid</th><th className="text-right">Spread bps</th><th className="text-right">L1 imbalance</th><th className="text-right">Status</th>
          </tr></thead>
          <tbody>
            {VENUES.map((v) => {
              const s = state[v.id]!, q = s.quote;
              return (
                <tr key={v.id} className="border-t">
                  <td className="py-1.5">{v.exchange}</td><td className="uppercase">{v.market}</td>
                  <td className="text-right text-bid">{q ? fmt(q.bid) : "—"}</td>
                  <td className="text-right text-ask">{q ? fmt(q.ask) : "—"}</td>
                  <td className="text-right">{q ? fmt(mid(q)) : "—"}</td>
                  <td className="text-right">{q ? fmt(((q.ask - q.bid) / mid(q)) * 10000, 3) : "—"}</td>
                  <td className={`text-right ${q && l1Imbalance(q) >= 0 ? "text-bid" : "text-ask"}`}>{q ? fmt(l1Imbalance(q)) : "—"}</td>
                  <td className={`text-right uppercase ${s.status === "live" ? "text-live" : s.status === "down" ? "text-destructive" : "text-warn"}`}>{s.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-2 text-xs text-muted-foreground">Cross-venue mid dispersion (live venues): {disp === null ? "need 2+ live venues" : `${fmt(disp)} bps`}</div>
      </div>

      <div className="panel mt-4 p-3">
        <div className="label-caps mb-2">Perpetual funding rate (refreshed every 30 s)</div>
        <div className="grid gap-3 sm:grid-cols-3">
          {EXCH.map((e) => {
            const f = funding[e];
            return (
              <div key={e} className="rounded-sm border p-3">
                <div className="text-xs text-muted-foreground">{e}</div>
                {f === undefined ? <div className="font-mono text-sm text-muted-foreground">loading…</div>
                  : f === "error" ? <div className="font-mono text-sm text-destructive">unavailable</div>
                  : <>
                      <div className={`font-mono text-lg ${f.rate >= 0 ? "text-bid" : "text-ask"}`}>{(f.rate * 100).toFixed(4)}%</div>
                      <div className="text-xs text-muted-foreground">{f.nextTime ? `next ${new Date(f.nextTime).toISOString().slice(11, 16)} UTC` : ""}</div>
                    </>}
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Sources: public read-only feeds from Binance, Bybit and OKX (level-1 quotes). Some exchanges block certain countries; a venue showing DOWN or "unavailable" means its feed couldn't be reached from your network — no values are filled in. Differences between markets are observed facts, not evidence of manipulation. Timestamps use your browser clock.
      </p>
    </>
  );
}

function BasisChart({ history }: { history: { t: number; basis: Record<string, number | null> }[] }) {
  const W = 800, H = 180;
  const vals = history.flatMap((h) => Object.values(h.basis).filter((x): x is number => x !== null));
  if (vals.length < 2) return <div className="flex h-[180px] items-center justify-center text-xs text-muted-foreground">Collecting data…</div>;
  let lo = Math.min(...vals, 0), hi = Math.max(...vals, 0); if (hi - lo < 1) { hi += 0.5; lo -= 0.5; }
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H, x = (i: number) => (i / (HISTORY - 1)) * W;
  const off = HISTORY - history.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-[180px] w-full" preserveAspectRatio="none">
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--border)" strokeDasharray="4 4" />
      {EXCH.map((e) => {
        let d = "", pen = false;
        history.forEach((h, i) => { const v = h.basis[e]; if (v === null || v === undefined) { pen = false; return; } d += `${pen ? "L" : "M"}${x(i + off)},${y(v)}`; pen = true; });
        return <path key={e} d={d} fill="none" stroke={COLORS[e]} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />;
      })}
      <text x={4} y={12} fontSize={11} fill="var(--muted-foreground)">{hi.toFixed(2)}</text>
      <text x={4} y={H - 4} fontSize={11} fill="var(--muted-foreground)">{lo.toFixed(2)}</text>
    </svg>
  );
}

import { useEffect, useRef, useState } from "react";
import { bucketDepth, parseAggTrade, type DepthCol, type Trade } from "@/lib/market/dualbook";

const BUCKET = 5, MAX = 300;
const FEEDS = {
  spot: { label: "Binance Spot BTCUSDT", depth: "https://data-api.binance.vision/api/v3/depth?symbol=BTCUSDT&limit=1000", ws: "wss://data-stream.binance.vision/ws/btcusdt@aggTrade" },
  perp: { label: "Binance USDⓈ-M Perpetual BTCUSDT", depth: "https://fapi.binance.com/fapi/v1/depth?symbol=BTCUSDT&limit=1000", ws: "wss://fstream.binance.com/ws/btcusdt@aggTrade" },
} as const;
type Key = keyof typeof FEEDS;
interface Side { cols: DepthCol[]; trades: Trade[]; depthOk: boolean; tradeOk: boolean; lastDepth: number | null; lastTrade: number | null; errors: number }

function useDual() {
  const s = useRef<Record<Key, Side>>({
    spot: { cols: [], trades: [], depthOk: false, tradeOk: false, lastDepth: null, lastTrade: null, errors: 0 },
    perp: { cols: [], trades: [], depthOk: false, tradeOk: false, lastDepth: null, lastTrade: null, errors: 0 },
  });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let closed = false; const socks: WebSocket[] = []; const timers: ReturnType<typeof setTimeout>[] = [];
    (Object.keys(FEEDS) as Key[]).forEach((k) => {
      const st = s.current[k];
      let retry = 0;
      const connect = () => {
        const ws = new WebSocket(FEEDS[k].ws); socks.push(ws);
        ws.onopen = () => { retry = 0; st.tradeOk = true; };
        ws.onmessage = (m) => { let j; try { j = JSON.parse(m.data); } catch { return; } const t = parseAggTrade(j); if (!t) return; st.trades.push(t); st.lastTrade = Date.now(); };
        ws.onclose = () => { st.tradeOk = false; if (!closed) timers.push(setTimeout(connect, Math.min(30000, 1000 * 2 ** retry++))); };
      };
      connect();
    });
    let busy = false;
    const iv = setInterval(async () => {
      const now = Date.now();
      setTick((x) => x + 1);
      if (busy) return; busy = true;
      await Promise.all((Object.keys(FEEDS) as Key[]).map(async (k) => {
        const st = s.current[k];
        try {
          const r = await fetch(FEEDS[k].depth); if (!r.ok) throw 0;
          const c = bucketDepth(await r.json(), BUCKET, now); if (!c) throw 0;
          st.cols.push(c); if (st.cols.length > MAX) st.cols.shift();
          st.depthOk = true; st.lastDepth = Date.now();
        } catch { st.depthOk = false; st.errors++; }
        const cut = now - MAX * 1000; while (st.trades.length && st.trades[0]!.t < cut) st.trades.shift();
      }));
      busy = false;
    }, 1000);
    return () => { closed = true; clearInterval(iv); timers.forEach(clearTimeout); socks.forEach((w) => w.close()); };
  }, []);
  return { state: s.current, tick };
}

export function DualHeatmap() {
  const { state, tick } = useDual();
  const [range, setRange] = useState(300);
  const [seconds, setSeconds] = useState(180);
  const [minBubble, setMinBubble] = useState(0.05);
  const center = state.spot.cols.at(-1)?.mid ?? state.perp.cols.at(-1)?.mid ?? 0;
  const c = Math.round(center / BUCKET) * BUCKET;
  return (
    <div className="panel mt-4 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="label-caps">Live spot vs perpetual heatmaps · trade bubbles</div>
        <div className="flex flex-wrap gap-2 text-xs">
          <label>Range <select className="rounded-sm border bg-background px-1" value={range} onChange={(e) => setRange(+e.target.value)}>{[100, 200, 300, 600, 1000].map((v) => <option key={v} value={v}>±${v}</option>)}</select></label>
          <label>Window <select className="rounded-sm border bg-background px-1" value={seconds} onChange={(e) => setSeconds(+e.target.value)}>{[60, 180, 300].map((v) => <option key={v} value={v}>{v / 60} min</option>)}</select></label>
          <label>Min trade <select className="rounded-sm border bg-background px-1" value={minBubble} onChange={(e) => setMinBubble(+e.target.value)}>{[0, 0.05, 0.25, 1, 5].map((v) => <option key={v} value={v}>{v} BTC</option>)}</select></label>
        </div>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {(Object.keys(FEEDS) as Key[]).map((k) => (
          <Pane key={k} title={FEEDS[k].label} side={state[k]} lo={c - range} hi={c + range} seconds={seconds} minBubble={minBubble} tick={tick} />
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Depth: full 1000-level REST snapshots polled every second, bucketed to ${BUCKET}; colour intensity = log resting size (green bid, red ask); yellow line = mid. Bubbles: public aggregated trades, area ∝ size, green = buyer-initiated, red = seller-initiated. Both panes share one price axis centred on spot so the basis is visible. Session-only (last {MAX / 60} min in this tab); nothing simulated. Co-movement between panes is an observation, not proof of which market leads.
      </p>
    </div>
  );
}

function Pane({ title, side, lo, hi, seconds, minBubble, tick }: { title: string; side: Side; lo: number; hi: number; seconds: number; minBubble: number; tick: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const stale = !side.lastDepth || Date.now() - side.lastDepth > 5000;
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext("2d")!; g.scale(dpr, dpr);
    g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--background"); g.fillRect(0, 0, W, H);
    const now = Date.now(), t0 = now - seconds * 1000;
    const view = side.cols.filter((c) => c.t >= t0);
    if (!view.length || hi <= lo) return;
    const xOf = (t: number) => ((t - t0) / (seconds * 1000)) * W, yOf = (p: number) => H - ((p - lo) / (hi - lo)) * H;
    let max = 0; for (const c of view) for (const [p, v] of c.levels) if (p >= lo && p <= hi) max = Math.max(max, v.bid + v.ask);
    const cw = Math.ceil(W / seconds) + 1, rh = Math.ceil((H * BUCKET) / (hi - lo));
    for (const c of view) for (const [p, v] of c.levels) {
      if (p < lo || p > hi) continue;
      const a = Math.log1p(v.bid + v.ask) / Math.log1p(max || 1);
      g.fillStyle = v.bid >= v.ask ? `oklch(0.76 0.14 170 / ${a})` : `oklch(0.68 0.2 22 / ${a})`;
      g.fillRect(xOf(c.t) - cw, yOf(p + BUCKET), cw, rh);
    }
    g.strokeStyle = "oklch(0.8 0.15 75)"; g.lineWidth = 1.5; g.beginPath();
    view.forEach((c, i) => (i ? g.lineTo(xOf(c.t), yOf(c.mid)) : g.moveTo(xOf(c.t), yOf(c.mid)))); g.stroke();
    for (const tr of side.trades) {
      if (tr.t < t0 || tr.qty < minBubble || tr.price < lo || tr.price > hi) continue;
      const r = Math.min(18, 2 + Math.sqrt(tr.qty) * 4);
      g.beginPath(); g.arc(xOf(tr.t), yOf(tr.price), r, 0, Math.PI * 2);
      g.fillStyle = tr.side === "buy" ? "oklch(0.8 0.17 150 / 0.55)" : "oklch(0.7 0.22 25 / 0.55)"; g.fill();
      g.strokeStyle = tr.side === "buy" ? "oklch(0.85 0.17 150)" : "oklch(0.75 0.22 25)"; g.lineWidth = 1; g.stroke();
    }
    g.fillStyle = "oklch(0.66 0.02 245)"; g.font = "10px JetBrains Mono, monospace";
    for (let k = 0; k <= 6; k++) { const p = lo + ((hi - lo) * k) / 6; g.fillText(p.toFixed(0), 4, yOf(p) - 2); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, lo, hi, seconds, minBubble]);
  const last = side.cols.at(-1);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span>{title}</span>
        <span className="font-mono">
          {last ? `mid ${last.mid.toFixed(1)}` : ""}{" "}
          <span className={stale ? "text-warn" : "text-live"}>{stale ? "DEPTH STALE" : "DEPTH LIVE"}</span>{" · "}
          <span className={side.tradeOk ? "text-live" : "text-destructive"}>{side.tradeOk ? "TRADES LIVE" : "TRADES DOWN"}</span>
        </span>
      </div>
      <div className="relative">
        <canvas ref={ref} className="h-[380px] w-full rounded-sm border" />
        {!side.cols.length && <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">{side.errors ? "Depth feed unreachable from your network — no data shown" : "Waiting for first snapshot…"}</div>}
      </div>
    </div>
  );
}

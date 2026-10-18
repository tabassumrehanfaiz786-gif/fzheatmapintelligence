import { useEffect, useRef, useState } from "react";
import { Download, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUCKET, exportColumnsCSV, useFeed, type Column } from "@/lib/market/binance-feed";
import { parseAggTrade, type Trade } from "@/lib/market/dualbook";

export function BookmapScreen() {
  const feed = useFeed();
  const canvas = useRef<HTMLCanvasElement>(null);
  const trades = useRef<Trade[]>([]);
  const [tradeLive, setTradeLive] = useState(false);
  const [seconds, setSeconds] = useState(180);
  const [range, setRange] = useState(500);
  const [minimum, setMinimum] = useState(0.05);
  const [frozen, setFrozen] = useState<Column[] | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const columns = frozen ?? feed.columns;
  const last = columns.at(-1);
  const center = last ? Math.round(last.mid / BUCKET) * BUCKET : 0;
  const end = last?.t ?? 0, start = end - seconds * 1000;
  const lo = center - range, hi = center + range;

  useEffect(() => {
    let closed = false, retry = 0;
    let socket: WebSocket | undefined, timer: ReturnType<typeof setTimeout> | undefined;
    function connect() {
      socket = new WebSocket("wss://data-stream.binance.vision/ws/btcusdt@aggTrade");
      socket.onopen = () => { retry = 0; setTradeLive(true); };
      socket.onmessage = (e) => {
        try {
          const t = parseAggTrade(JSON.parse(e.data));
          if (!t) return;
          trades.current.push(t);
          const cut = Date.now() - 600000;
          while (trades.current[0] && trades.current[0].t < cut) trades.current.shift();
        } catch { /* invalid exchange message */ }
      };
      socket.onclose = () => { setTradeLive(false); if (!closed) timer = setTimeout(connect, Math.min(30000, 1000 * 2 ** retry++)); };
    }
    connect();
    return () => { closed = true; clearTimeout(timer); socket?.close(); };
  }, []);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const draw = () => {
      const w = cv.clientWidth, h = cv.clientHeight, dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      const g = cv.getContext("2d"); if (!g) return;
      g.scale(dpr, dpr);
      const css = getComputedStyle(document.documentElement);
      const token = (name: string) => css.getPropertyValue(name).trim();
      g.fillStyle = token("--background"); g.fillRect(0, 0, w, h);
      if (!last) return;
      const pw = w - 68, ph = h - 28;
      const x = (t: number) => (t - start) / (seconds * 1000) * pw;
      const y = (p: number) => (hi - p) / (hi - lo) * ph;
      const visible = columns.filter((c) => c.t >= start);
      let max = 1;
      for (const c of visible) for (const [p, v] of c.levels) if (p >= lo && p <= hi) max = Math.max(max, v.bid + v.ask);
      g.save(); g.beginPath(); g.rect(0, 0, pw, ph); g.clip();
      for (let i = 0; i < visible.length; i++) {
        const c = visible[i]; if (!c) continue;
        const next = visible[i + 1];
        const width = Math.max(1, x(Math.min(c.t + 1100, next?.t ?? end)) - x(c.t));
        for (const [p, v] of c.levels) {
          if (p < lo || p > hi) continue;
          const intensity = Math.log1p(v.bid + v.ask) / Math.log1p(max);
          g.globalAlpha = Math.max(0.07, intensity * 0.85);
          g.fillStyle = token(intensity > 0.8 ? "--heat-high" : intensity > 0.5 ? "--heat-medium" : "--heat-low");
          g.fillRect(x(c.t), y(p + BUCKET), width + 0.5, Math.max(1, ph * BUCKET / (hi - lo)));
        }
      }
      g.globalAlpha = 1; g.strokeStyle = token("--primary"); g.lineWidth = 1.2;
      g.beginPath(); visible.forEach((c, i) => i ? g.lineTo(x(c.t), y(c.mid)) : g.moveTo(x(c.t), y(c.mid))); g.stroke();
      for (const t of trades.current) {
        if (t.t < start || t.t > end || t.price < lo || t.price > hi || t.qty < minimum) continue;
        g.beginPath(); g.arc(x(t.t), y(t.price), Math.min(22, 2 + Math.sqrt(t.qty) * 5), 0, 2 * Math.PI);
        g.fillStyle = token(t.side === "buy" ? "--bid" : "--ask"); g.globalAlpha = 0.65; g.fill();
        g.globalAlpha = 1; g.lineWidth = 0.8; g.strokeStyle = token("--foreground"); g.stroke();
      }
      g.restore(); g.globalAlpha = 1;
      g.font = "10px JetBrains Mono, monospace";
      for (let i = 0; i <= 8; i++) {
        const price = lo + (hi - lo) * i / 8, yy = Math.max(12, y(price));
        g.strokeStyle = token("--border"); g.globalAlpha = 0.4; g.beginPath(); g.moveTo(0, yy); g.lineTo(pw, yy); g.stroke(); g.globalAlpha = 1;
        g.fillStyle = token("--muted-foreground"); g.fillText(price.toFixed(0), pw + 7, yy);
      }
      for (let i = 0; i <= 4; i++) {
        const t = start + seconds * 1000 * i / 4;
        g.fillStyle = token("--muted-foreground");
        g.fillText(new Date(t).toISOString().slice(11, 19), Math.min(Math.max(2, x(t)), pw - 55), h - 8);
      }
      g.fillStyle = token("--primary"); g.fillText(last.mid.toFixed(1), pw + 4, y(last.mid));
    };
    draw(); const observer = new ResizeObserver(draw); observer.observe(cv);
    return () => observer.disconnect();
  }, [feed.tick, frozen, seconds, range, minimum]);

  const ladder = last ? [...last.levels].filter(([p]) => Math.abs(p - center) <= range).sort(([a], [b]) => b - a).filter((_, i, all) => i % Math.max(1, Math.ceil(all.length / 22)) === 0) : [];
  const maxDepth = Math.max(1, ...ladder.map(([, v]) => v.bid + v.ask));
  return (
    <section className="mb-5 border-y bg-background" aria-label="Live liquidity terminal">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b py-3">
        <div><h2 className="font-mono text-sm font-semibold">BTC / USDT <span className="text-muted-foreground">· LIQUIDITY MAP</span></h2><div className="mt-1 flex gap-3 font-mono text-xs"><span className={feed.status === "live" ? "text-live" : "text-warn"}>{frozen ? "PAUSED" : feed.status.toUpperCase()}</span><span className={tradeLive ? "text-live" : "text-warn"}>TRADES {tradeLive ? "LIVE" : "OFFLINE"}</span><span className="text-muted-foreground">BINANCE SPOT</span></div></div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1" aria-label="Time window">{[60, 180, 300, 600].map((s) => <Button key={s} size="sm" variant={seconds === s ? "secondary" : "ghost"} onClick={() => setSeconds(s)}>{s / 60}m</Button>)}</div>
          <label className="text-xs text-muted-foreground">Range <select aria-label="Liquidity price range" className="border bg-background p-1 text-foreground" value={range} onChange={(e) => setRange(Number(e.target.value))}>{[250, 500, 1000, 1500].map((r) => <option key={r} value={r}>±${r}</option>)}</select></label>
          <label className="text-xs text-muted-foreground">Trade ≥ <select aria-label="Minimum bubble quantity" className="border bg-background p-1 text-foreground" value={minimum} onChange={(e) => setMinimum(Number(e.target.value))}>{[0, 0.05, 0.25, 1, 5].map((r) => <option key={r} value={r}>{r} BTC</option>)}</select></label>
          <Button size="icon" variant="ghost" aria-label={frozen ? "Resume liquidity map" : "Pause liquidity map"} title={frozen ? "Resume" : "Pause"} onClick={() => setFrozen(frozen ? null : [...feed.columns])}>{frozen ? <Play /> : <Pause />}</Button>
          <Button size="icon" variant="ghost" aria-label="Export liquidity CSV" title="Export CSV" disabled={!last} onClick={() => exportColumnsCSV(columns, range)}><Download /></Button>
        </div>
      </div>
      <div className="grid min-w-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_150px]">
        <div className="relative min-w-0"><canvas aria-label="BTC live order-book heatmap with trade bubbles" ref={canvas} className="h-[460px] w-full md:h-[530px]" onMouseLeave={() => setHover(null)} onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
          const t = start + px / (r.width - 68) * seconds * 1000;
          const c = columns.find((c) => c.t >= t); if (!c) { setHover(null); return; }
          const price = Math.floor((hi - py / (r.height - 28) * (hi - lo)) / BUCKET) * BUCKET, v = c.levels.get(price);
          setHover(`${new Date(c.t).toISOString().slice(11, 19)}Z · $${price} · bid ${(v?.bid ?? 0).toFixed(3)} / ask ${(v?.ask ?? 0).toFixed(3)} BTC`);
        }} />{!last && <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Waiting for synchronised live depth…</div>}{hover && <div className="pointer-events-none absolute bottom-8 left-2 max-w-[90%] border bg-popover px-2 py-1 font-mono text-xs">{hover}</div>}</div>
        <aside className="hidden border-l px-2 py-3 lg:block"><div className="mb-2 font-mono text-xs text-muted-foreground">DEPTH · BTC</div>{ladder.map(([p, v]) => <div key={p} className="relative mb-1 flex justify-between font-mono text-[10px]"><div className={`absolute inset-y-0 right-0 ${v.bid >= v.ask ? "bg-bid/20" : "bg-ask/20"}`} style={{ width: `${(v.bid + v.ask) / maxDepth * 100}%` }} /><span className="relative">{p}</span><span className={`relative ${v.bid >= v.ask ? "text-bid" : "text-ask"}`}>{(v.bid + v.ask).toFixed(2)}</span></div>)}</aside>
      </div>
      <div className="flex flex-wrap justify-between gap-2 border-t py-2 font-mono text-[10px] text-muted-foreground"><span>RESTING SIZE <span className="text-heat-low">LOW</span> → <span className="text-heat-high">HIGH</span> · <span className="text-bid">BUY</span> / <span className="text-ask">SELL</span> TRADES</span><span>{columns.length} samples · $10 buckets · 1s · UTC · tab-only history ≤10m</span></div>
    </section>
  );
}
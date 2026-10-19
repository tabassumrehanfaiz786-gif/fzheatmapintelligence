import { useEffect, useRef, useState } from "react";
import { BUCKET, type Column } from "@/lib/market/binance-feed";

// Canvas price-vs-time heatmap. Intensity = log-scaled bucket quantity.
export function Heatmap({ columns, range, seconds, tick }: { columns: Column[]; range: number; seconds: number; tick: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);
  const view = columns.slice(-seconds);
  const last = view.at(-1);
  const center = last ? Math.round(last.mid / BUCKET) * BUCKET : 0;
  const lo = center - range, hi = center + range;

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext("2d"); if (!g) return; g.scale(dpr, dpr);
    const css = getComputedStyle(document.documentElement);
    g.fillStyle = css.getPropertyValue("--background"); g.fillRect(0, 0, W, H);
    if (!view.length) return;
    let max = 0;
    for (const c of view) for (const [p, v] of c.levels) if (p >= lo && p <= hi) max = Math.max(max, v.bid + v.ask);
    const cw = W / seconds, rows = (hi - lo) / BUCKET, rh = H / rows;
    const yOf = (p: number) => H - ((p - lo) / (hi - lo)) * H;
    const off = seconds - view.length;
    view.forEach((c, i) => {
      for (const [p, v] of c.levels) {
        if (p < lo || p > hi) continue;
        const q = v.bid + v.ask, a = Math.log1p(q) / Math.log1p(max || 1);
        g.fillStyle = css.getPropertyValue(v.bid >= v.ask ? "--bid" : "--ask"); g.globalAlpha = a;
        g.fillRect((i + off) * cw, yOf(p + BUCKET), Math.ceil(cw), Math.ceil(rh));
      }
    });
    g.globalAlpha = 1; g.strokeStyle = css.getPropertyValue("--primary"); g.lineWidth = 1.5; g.beginPath();
    view.forEach((c, i) => { const x = (i + off + 0.5) * cw, y = yOf(c.mid); i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.stroke();
    g.fillStyle = css.getPropertyValue("--muted-foreground"); g.font = "10px JetBrains Mono, monospace";
    for (let k = 0; k <= 6; k++) { const p = lo + ((hi - lo) * k) / 6; g.fillText(p.toFixed(0), 4, yOf(p) - 2); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, range, seconds, columns]);

  function onMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const i = Math.floor((x / r.width) * seconds) - (seconds - view.length);
    const c = view[i]; if (!c) return setHover(null);
    const p = Math.floor((lo + (1 - y / r.height) * (hi - lo)) / BUCKET) * BUCKET;
    const v = c.levels.get(p);
    setHover({ x, y, text: `${new Date(c.t).toISOString().slice(11, 19)}Z · $${p}–${p + BUCKET} · bid ${(v?.bid ?? 0).toFixed(3)} · ask ${(v?.ask ?? 0).toFixed(3)} BTC` });
  }

  return (
    <div className="relative">
      <canvas ref={ref} className="h-[420px] w-full rounded-sm border md:h-[560px]" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      {hover && <div className="pointer-events-none absolute rounded-sm border bg-popover px-2 py-1 font-mono text-[0.7rem]" style={{ left: Math.min(hover.x + 12, 600), top: hover.y + 12 }}>{hover.text}</div>}
      {!view.length && <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Waiting for synchronised order book…</div>}
    </div>
  );
}

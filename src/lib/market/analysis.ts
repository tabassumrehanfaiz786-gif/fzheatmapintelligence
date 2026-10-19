// Pure liquidity-event detection over bucketed order-book columns (1 column ≈ 1 s).
// Events describe changes in DISPLAYED liquidity at price buckets. They never identify
// orders or participants: a withdrawal at one level and an addition at another are
// only flagged as a *possible* relocation, a hypothesis to test.
import type { Column } from "./binance-feed";

export const ANALYSIS_VERSION = "fzhmi-analysis 1.0.0";

export interface Params {
  minQty: number;        // BTC change at a bucket to count as significant
  minPct: number;        // relative change (0–1) required as well
  maxDistance: number;   // only analyse buckets within this USD distance of mid
  touchTolerance: number;// USD: price "reached" the level if best quote came within this
  relocateWindow: number;// seconds to look for reappearance after a withdrawal
  relocateSizeTol: number;// relative size tolerance for reappearance (0–1)
  shortLivedMax: number; // seconds: large liquidity living ≤ this and withdrawn untouched
}
export const DEFAULT_PARAMS: Params = { minQty: 5, minPct: 0.5, maxDistance: 500, touchTolerance: 10, relocateWindow: 10, relocateSizeTol: 0.3, shortLivedMax: 5 };

export type EventType = "added" | "consumed" | "withdrawn" | "possible_relocation" | "short_lived";
export interface LiquidityEvent {
  id: string; type: EventType; t: number; side: "bid" | "ask"; price: number;
  qty: number; before: number; after: number; mid: number; distance: number;
  lifetime?: number; relatedId?: string; toPrice?: number; note: string;
}

function touched(c: Column, side: "bid" | "ask", price: number, tol: number) {
  // A bid level is "reached" if best ask came down to it; ask level if best bid rose to it.
  return side === "bid" ? c.bestAsk <= price + tol || c.mid <= price : c.bestBid >= price - tol || c.mid >= price;
}

export function detectEvents(cols: Column[], p: Params = DEFAULT_PARAMS): LiquidityEvent[] {
  const out: LiquidityEvent[] = [];
  const born = new Map<string, number>(); // key side:price -> t when significant liquidity appeared
  let n = 0;
  for (let i = 1; i < cols.length; i++) {
    const a = cols[i - 1]!, b = cols[i]!;
    const prices = new Set([...a.levels.keys(), ...b.levels.keys()]);
    for (const price of prices) {
      if (Math.abs(price - b.mid) > p.maxDistance) continue;
      for (const side of ["bid", "ask"] as const) {
        const before = a.levels.get(price)?.[side] ?? 0, after = b.levels.get(price)?.[side] ?? 0;
        const d = after - before, key = `${side}:${price}`;
        if (Math.abs(d) < p.minQty || Math.abs(d) / Math.max(before, after, 1e-9) < p.minPct) continue;
        const base = { t: b.t, side, price, qty: Math.abs(d), before, after, mid: b.mid, distance: price - b.mid };
        if (d > 0) {
          born.set(key, b.t);
          out.push({ ...base, id: `E${++n}`, type: "added", note: "Displayed size increased at this level." });
        } else {
          const wasTouched = touched(b, side, price, p.touchTolerance) || touched(a, side, price, p.touchTolerance);
          const bt = born.get(key); born.delete(key);
          if (wasTouched) out.push({ ...base, id: `E${++n}`, type: "consumed", note: "Size fell while price was at/through the level — consistent with execution (trades not verified)." });
          else {
            const life = bt !== undefined ? (b.t - bt) / 1000 : undefined;
            const ev: LiquidityEvent = { ...base, id: `E${++n}`, type: "withdrawn", note: "Size fell while price was away from the level — consistent with cancellation.", ...(life !== undefined ? { lifetime: life } : {}) };
            out.push(ev);
            if (life !== undefined && life <= p.shortLivedMax)
              out.push({ ...base, id: `E${++n}`, type: "short_lived", lifetime: life, relatedId: ev.id, note: `Large size appeared and was withdrawn within ${life.toFixed(0)} s without price reaching it. Potential spoofing indicator only — not proof.` });
          }
        }
      }
    }
  }
  // Possible relocation: withdrawal followed by a similar-size addition on the same side at a different price.
  const adds = out.filter((e) => e.type === "added");
  for (const w of out.filter((e) => e.type === "withdrawn")) {
    const m = adds.find((x) => x.side === w.side && x.price !== w.price && x.t >= w.t && x.t - w.t <= p.relocateWindow * 1000 && Math.abs(x.qty - w.qty) / w.qty <= p.relocateSizeTol);
    if (m) out.push({ ...w, id: `E${++n}`, type: "possible_relocation", relatedId: m.id, toPrice: m.price, t: m.t, note: `Similar size reappeared at ${m.price} within ${((m.t - w.t) / 1000).toFixed(0)} s. Not evidence of the same order or participant.` });
  }
  return out.sort((x, y) => x.t - y.t);
}

export interface Summary { columns: number; seconds: number; counts: Record<EventType, number>; meanSize: Record<EventType, number>; gaps: number; flickerLevels: { side: string; price: number; cycles: number }[] }
export function summarise(cols: Column[], ev: LiquidityEvent[]): Summary {
  const types: EventType[] = ["added", "consumed", "withdrawn", "possible_relocation", "short_lived"];
  const counts = Object.fromEntries(types.map((t) => [t, 0])) as Record<EventType, number>;
  const sums = { ...counts };
  for (const e of ev) { counts[e.type]++; sums[e.type] += e.qty; }
  const meanSize = Object.fromEntries(types.map((t) => [t, counts[t] ? sums[t] / counts[t] : 0])) as Record<EventType, number>;
  let gaps = 0; for (let i = 1; i < cols.length; i++) if (cols[i]!.t - cols[i - 1]!.t > 2500) gaps++;
  const cyc = new Map<string, number>();
  for (const e of ev) if (e.type === "added" || e.type === "withdrawn") { const k = `${e.side}:${e.price}`; cyc.set(k, (cyc.get(k) ?? 0) + 0.5); }
  const flickerLevels = [...cyc].map(([k, c]) => ({ side: k.split(":")[0]!, price: Number(k.split(":")[1]), cycles: Math.floor(c) })).filter((x) => x.cycles >= 3).sort((a, b) => b.cycles - a.cycles).slice(0, 15);
  return { columns: cols.length, seconds: cols.length > 1 ? (cols.at(-1)!.t - cols[0]!.t) / 1000 : 0, counts, meanSize, gaps, flickerLevels };
}

export function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
export function eventsCSV(ev: LiquidityEvent[]) {
  const h = "id,type,timestamp_utc,side,price,qty,before,after,mid,distance,lifetime_s,related_id,to_price";
  return [h, ...ev.map((e) => [e.id, e.type, new Date(e.t).toISOString(), e.side, e.price, e.qty.toFixed(4), e.before.toFixed(4), e.after.toFixed(4), e.mid.toFixed(2), e.distance.toFixed(2), e.lifetime ?? "", e.relatedId ?? "", e.toPrice ?? ""].join(","))].join("\n");
}

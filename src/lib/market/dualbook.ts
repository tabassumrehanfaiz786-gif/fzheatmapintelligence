// Pure helpers for the side-by-side spot vs perpetual heatmap (Binance spot + USDⓈ-M perp).
// Depth = full REST snapshots polled once per second; trades = public aggTrade stream.

export interface DepthCol { t: number; mid: number; levels: Map<number, { bid: number; ask: number }> }
export interface Trade { t: number; price: number; qty: number; side: "buy" | "sell" }

const n = (x: unknown) => (typeof x === "string" || typeof x === "number" ? Number(x) : NaN);

/** Bucket a REST depth snapshot ({bids, asks}) into price buckets. Returns null if empty/crossed/invalid. */
export function bucketDepth(raw: unknown, bucket: number, t: number): DepthCol | null {
  const o = raw as { bids?: unknown[][]; asks?: unknown[][] };
  if (!Array.isArray(o?.bids) || !Array.isArray(o?.asks) || !o.bids.length || !o.asks.length) return null;
  const bb = n(o.bids[0]![0]), ba = n(o.asks[0]![0]);
  if (!Number.isFinite(bb) || !Number.isFinite(ba) || bb <= 0 || bb >= ba) return null;
  const levels = new Map<number, { bid: number; ask: number }>();
  const add = (rows: unknown[][], side: "bid" | "ask") => {
    for (const r of rows) {
      const p = n(r[0]), q = n(r[1]);
      if (!Number.isFinite(p) || !Number.isFinite(q) || q <= 0) continue;
      const k = Math.floor(p / bucket) * bucket;
      const v = levels.get(k) ?? { bid: 0, ask: 0 }; v[side] += q; levels.set(k, v);
    }
  };
  add(o.bids, "bid"); add(o.asks, "ask");
  return { t, mid: (bb + ba) / 2, levels };
}

/** Binance aggTrade: m=true → buyer is maker → aggressor sold. */
export function parseAggTrade(raw: unknown): Trade | null {
  const o = (raw as { data?: unknown })?.data ?? raw;
  const e = o as { e?: string; p?: unknown; q?: unknown; T?: unknown; m?: unknown };
  if (e?.e !== "aggTrade") return null;
  const price = n(e.p), qty = n(e.q), t = n(e.T);
  if (!(price > 0) || !(qty > 0) || !Number.isFinite(t)) return null;
  return { t, price, qty, side: e.m ? "sell" : "buy" };
}

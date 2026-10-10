// Pure order-book reconstruction for Binance diff-depth streams.
// Follows Binance's documented procedure: snapshot + buffered diffs, with
// strict sequence checking (U/u). Any gap forces a resync by the caller.

export type RawLevel = [string, string];
export interface DepthSnapshot { lastUpdateId: number; bids: RawLevel[]; asks: RawLevel[] }
export interface DepthEvent { E: number; U: number; u: number; b: RawLevel[]; a: RawLevel[] }
export type ApplyResult = "applied" | "stale" | "gap" | "invalid";

function parseLevels(levels: RawLevel[]): [number, number][] | null {
  const out: [number, number][] = [];
  for (const [p, q] of levels) {
    const price = Number(p), qty = Number(q);
    if (!Number.isFinite(price) || !Number.isFinite(qty) || price <= 0 || qty < 0) return null;
    out.push([price, qty]);
  }
  return out;
}

export class OrderBook {
  bids = new Map<number, number>();
  asks = new Map<number, number>();
  lastUpdateId = 0;
  private firstApplied = false;

  loadSnapshot(s: DepthSnapshot): boolean {
    const b = parseLevels(s.bids), a = parseLevels(s.asks);
    if (!b || !a) return false;
    this.bids = new Map(b.filter(([, q]) => q > 0));
    this.asks = new Map(a.filter(([, q]) => q > 0));
    this.lastUpdateId = s.lastUpdateId;
    this.firstApplied = false;
    return true;
  }

  apply(e: DepthEvent): ApplyResult {
    if (e.u <= this.lastUpdateId) return "stale";
    if (!this.firstApplied) {
      if (!(e.U <= this.lastUpdateId + 1 && e.u >= this.lastUpdateId + 1)) return "gap";
    } else if (e.U !== this.lastUpdateId + 1) return "gap";
    const b = parseLevels(e.b), a = parseLevels(e.a);
    if (!b || !a) return "invalid";
    for (const [p, q] of b) q === 0 ? this.bids.delete(p) : this.bids.set(p, q);
    for (const [p, q] of a) q === 0 ? this.asks.delete(p) : this.asks.set(p, q);
    this.lastUpdateId = e.u;
    this.firstApplied = true;
    return "applied";
  }

  bestBid(): number | null { let m = -Infinity; for (const p of this.bids.keys()) if (p > m) m = p; return m === -Infinity ? null : m; }
  bestAsk(): number | null { let m = Infinity; for (const p of this.asks.keys()) if (p < m) m = p; return m === Infinity ? null : m; }
  isCrossed(): boolean { const b = this.bestBid(), a = this.bestAsk(); return b !== null && a !== null && b >= a; }

  /** Sum of quantity within `pct` percent of mid on each side. */
  depthWithin(pct: number): { bid: number; ask: number } | null {
    const b = this.bestBid(), a = this.bestAsk();
    if (b === null || a === null) return null;
    const mid = (a + b) / 2, lo = mid * (1 - pct / 100), hi = mid * (1 + pct / 100);
    let bid = 0, ask = 0;
    for (const [p, q] of this.bids) if (p >= lo) bid += q;
    for (const [p, q] of this.asks) if (p <= hi) ask += q;
    return { bid, ask };
  }

  /** Aggregate quantity into price buckets of size `step`. */
  bucket(step: number): Map<number, { bid: number; ask: number }> {
    const m = new Map<number, { bid: number; ask: number }>();
    const add = (p: number, q: number, side: "bid" | "ask") => {
      const k = Math.floor(p / step) * step;
      const v = m.get(k) ?? { bid: 0, ask: 0 };
      v[side] += q; m.set(k, v);
    };
    for (const [p, q] of this.bids) add(p, q, "bid");
    for (const [p, q] of this.asks) add(p, q, "ask");
    return m;
  }
}

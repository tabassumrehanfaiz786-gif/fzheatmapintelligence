// Pure venue definitions + message parsers for top-of-book comparison (Stage 4).
// Public, read-only market-data endpoints only. No keys, no trading.

export type Market = "spot" | "perp";
export interface Quote { bid: number; bidQty: number; ask: number; askQty: number }

export interface Venue {
  id: string; exchange: string; market: Market; symbol: string; ws: string;
  subscribe?: string; ping?: { every: number; payload: string };
  parse: (raw: unknown) => Quote | null;
}

const num = (x: unknown) => { const n = typeof x === "string" ? Number(x) : typeof x === "number" ? x : NaN; return Number.isFinite(n) ? n : NaN; };
function valid(q: Quote): Quote | null {
  if (![q.bid, q.ask, q.bidQty, q.askQty].every(Number.isFinite)) return null;
  if (q.bid <= 0 || q.ask <= 0 || q.bid > q.ask) return null; // crossed / invalid
  return q;
}

export function parseBinanceBookTicker(m: unknown): Quote | null {
  const o = m as Record<string, unknown>;
  if (!o || o.b === undefined || o.a === undefined) return null;
  return valid({ bid: num(o.b), bidQty: num(o.B), ask: num(o.a), askQty: num(o.A) });
}

// Bybit orderbook.1 — both snapshot and delta carry full level-1 when present.
export function parseBybitL1(m: unknown): Quote | null {
  const o = m as { topic?: string; data?: { b?: string[][]; a?: string[][] } };
  const b = o?.data?.b?.[0], a = o?.data?.a?.[0];
  if (!o?.topic?.startsWith("orderbook.1") || !b || !a) return null;
  return valid({ bid: num(b[0]), bidQty: num(b[1]), ask: num(a[0]), askQty: num(a[1]) });
}

export function parseOkxBbo(m: unknown): Quote | null {
  const o = m as { arg?: { channel?: string }; data?: { bids?: string[][]; asks?: string[][] }[] };
  const d = o?.data?.[0], b = d?.bids?.[0], a = d?.asks?.[0];
  if (o?.arg?.channel !== "bbo-tbt" || !b || !a) return null;
  return valid({ bid: num(b[0]), bidQty: num(b[1]), ask: num(a[0]), askQty: num(a[1]) });
}

const bybitSub = JSON.stringify({ op: "subscribe", args: ["orderbook.1.BTCUSDT"] });
const okxSub = (inst: string) => JSON.stringify({ op: "subscribe", args: [{ channel: "bbo-tbt", instId: inst }] });

export const VENUES: Venue[] = [
  { id: "binance-spot", exchange: "Binance", market: "spot", symbol: "BTCUSDT", ws: "wss://data-stream.binance.vision/ws/btcusdt@bookTicker", parse: parseBinanceBookTicker },
  { id: "binance-perp", exchange: "Binance", market: "perp", symbol: "BTCUSDT-PERP", ws: "wss://fstream.binance.com/ws/btcusdt@bookTicker", parse: parseBinanceBookTicker },
  { id: "bybit-spot", exchange: "Bybit", market: "spot", symbol: "BTCUSDT", ws: "wss://stream.bybit.com/v5/public/spot", subscribe: bybitSub, ping: { every: 20000, payload: '{"op":"ping"}' }, parse: parseBybitL1 },
  { id: "bybit-perp", exchange: "Bybit", market: "perp", symbol: "BTCUSDT-PERP", ws: "wss://stream.bybit.com/v5/public/linear", subscribe: bybitSub, ping: { every: 20000, payload: '{"op":"ping"}' }, parse: parseBybitL1 },
  { id: "okx-spot", exchange: "OKX", market: "spot", symbol: "BTC-USDT", ws: "wss://ws.okx.com:8443/ws/v5/public", subscribe: okxSub("BTC-USDT"), ping: { every: 25000, payload: "ping" }, parse: parseOkxBbo },
  { id: "okx-perp", exchange: "OKX", market: "perp", symbol: "BTC-USDT-SWAP", ws: "wss://ws.okx.com:8443/ws/v5/public", subscribe: okxSub("BTC-USDT-SWAP"), ping: { every: 25000, payload: "ping" }, parse: parseOkxBbo },
];

export const mid = (q: Quote) => (q.bid + q.ask) / 2;
/** Basis in basis points: (perp mid − spot mid) / spot mid × 10 000. */
export const basisBps = (perp: Quote, spot: Quote) => ((mid(perp) - mid(spot)) / mid(spot)) * 10000;
/** Top-of-book quantity imbalance in [-1, 1]; positive = more bid size. */
export const l1Imbalance = (q: Quote) => (q.bidQty + q.askQty > 0 ? (q.bidQty - q.askQty) / (q.bidQty + q.askQty) : 0);

// Funding (REST, public). Returns rate as a fraction per funding interval.
export interface Funding { exchange: string; rate: number; nextTime: number | null }
export const FUNDING_SOURCES: { exchange: string; url: string; parse: (j: unknown) => Funding | null }[] = [
  { exchange: "Binance", url: "https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT",
    parse: (j) => { const o = j as { lastFundingRate?: string; nextFundingTime?: number }; const r = num(o?.lastFundingRate); return Number.isFinite(r) ? { exchange: "Binance", rate: r, nextTime: o.nextFundingTime ?? null } : null; } },
  { exchange: "Bybit", url: "https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT",
    parse: (j) => { const t = (j as { result?: { list?: { fundingRate?: string; nextFundingTime?: string }[] } })?.result?.list?.[0]; const r = num(t?.fundingRate); return Number.isFinite(r) ? { exchange: "Bybit", rate: r, nextTime: t?.nextFundingTime ? Number(t.nextFundingTime) : null } : null; } },
  { exchange: "OKX", url: "https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP",
    parse: (j) => { const t = (j as { data?: { fundingRate?: string; nextFundingTime?: string; fundingTime?: string }[] })?.data?.[0]; const r = num(t?.fundingRate); return Number.isFinite(r) ? { exchange: "OKX", rate: r, nextTime: t?.fundingTime ? Number(t.fundingTime) : null } : null; } },
];

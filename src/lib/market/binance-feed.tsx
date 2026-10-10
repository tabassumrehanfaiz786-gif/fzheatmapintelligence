import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { OrderBook, type DepthEvent } from "./orderbook";

// Public, read-only Binance market-data endpoints (no API key).
export const SOURCE = {
  exchange: "Binance Spot",
  symbol: "BTCUSDT",
  ws: "wss://data-stream.binance.vision/ws/btcusdt@depth@100ms",
  rest: "https://data-api.binance.vision/api/v3/depth?symbol=BTCUSDT&limit=1000",
};
export const BUCKET = 10; // USD price bucket for heatmap
export const MAX_COLUMNS = 600; // 1 column/sec → 10 minutes
const STALE_MS = 5000;

export type Status = "connecting" | "syncing" | "live" | "stale" | "resyncing" | "disconnected" | "error";
export interface Column { t: number; mid: number; bestBid: number; bestAsk: number; levels: Map<number, { bid: number; ask: number }> }
export interface MarketEvent { t: number; kind: "info" | "warn" | "error"; text: string }
export interface FeedStats { applied: number; stale: number; gaps: number; invalid: number; reconnects: number; snapshots: number }

interface FeedState {
  status: Status; book: OrderBook; columns: Column[]; events: MarketEvent[];
  stats: FeedStats; lastMessageAt: number | null; lastUpdateId: number; sessionStart: number | null; tick: number;
}
const Ctx = createContext<FeedState | null>(null);
export const useFeed = () => { const c = useContext(Ctx); if (!c) throw new Error("useFeed outside provider"); return c; };

export function MarketFeedProvider({ children }: { children: ReactNode }) {
  const book = useRef(new OrderBook());
  const columns = useRef<Column[]>([]);
  const events = useRef<MarketEvent[]>([]);
  const stats = useRef<FeedStats>({ applied: 0, stale: 0, gaps: 0, invalid: 0, reconnects: 0, snapshots: 0 });
  const lastMsg = useRef<number | null>(null);
  const statusRef = useRef<Status>("connecting");
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let ws: WebSocket | null = null, closed = false, buffer: DepthEvent[] = [], ready = false, retry = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    const log = (kind: MarketEvent["kind"], text: string) => { events.current = [{ t: Date.now(), kind, text }, ...events.current].slice(0, 200); };
    const setStatus = (s: Status) => { if (statusRef.current !== s) { statusRef.current = s; log(s === "live" ? "info" : s === "error" || s === "disconnected" ? "error" : "warn", `Feed status: ${s}`); } };

    async function snapshot() {
      ready = false; setStatus(statusRef.current === "live" || statusRef.current === "stale" ? "resyncing" : "syncing");
      try {
        const r = await fetch(SOURCE.rest);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const s = await r.json();
        if (!book.current.loadSnapshot(s)) throw new Error("invalid snapshot");
        stats.current.snapshots++;
        log("info", `Snapshot loaded (lastUpdateId ${s.lastUpdateId}, ${s.bids.length}+${s.asks.length} levels)`);
        const pending = buffer; buffer = []; ready = true;
        for (const e of pending) if (!handle(e)) return;
        setStatus("live");
      } catch (err) {
        setStatus("error"); log("error", `Snapshot failed: ${(err as Error).message}`);
        reconnectTimer = setTimeout(snapshot, 3000);
      }
    }
    function handle(e: DepthEvent): boolean {
      const r = book.current.apply(e);
      stats.current[r === "applied" ? "applied" : r === "stale" ? "stale" : r === "gap" ? "gaps" : "invalid"]++;
      if (r === "gap") { log("warn", `Sequence gap at U=${e.U} (expected ${book.current.lastUpdateId + 1}); resyncing`); snapshot(); return false; }
      if (r === "invalid") log("warn", `Invalid update u=${e.u} discarded`);
      return true;
    }
    function connect() {
      setStatus("connecting");
      ws = new WebSocket(SOURCE.ws);
      ws.onopen = () => { retry = 0; buffer = []; snapshot(); };
      ws.onmessage = (m) => {
        lastMsg.current = Date.now();
        let e: DepthEvent; try { e = JSON.parse(m.data); } catch { stats.current.invalid++; return; }
        if (typeof e.U !== "number" || typeof e.u !== "number") { stats.current.invalid++; return; }
        if (!ready) { buffer.push(e); return; }
        if (statusRef.current === "stale") setStatus("live");
        handle(e);
      };
      ws.onclose = () => {
        if (closed) return; ready = false; setStatus("disconnected");
        stats.current.reconnects++; const d = Math.min(30000, 1000 * 2 ** retry++);
        log("warn", `Reconnecting in ${d / 1000}s`); reconnectTimer = setTimeout(connect, d);
      };
      ws.onerror = () => log("error", "WebSocket error");
    }
    connect(); setSessionStart(Date.now());

    const iv = setInterval(() => {
      const now = Date.now();
      if (statusRef.current === "live" && lastMsg.current && now - lastMsg.current > STALE_MS) setStatus("stale");
      const b = book.current.bestBid(), a = book.current.bestAsk();
      if (statusRef.current === "live" && b !== null && a !== null && !book.current.isCrossed()) {
        columns.current.push({ t: now, mid: (a + b) / 2, bestBid: b, bestAsk: a, levels: book.current.bucket(BUCKET) });
        if (columns.current.length > MAX_COLUMNS) columns.current.shift();
      }
      setTick((x) => x + 1);
    }, 1000);
    return () => { closed = true; clearInterval(iv); clearTimeout(reconnectTimer); ws?.close(); };
  }, []);

  return (
    <Ctx.Provider value={{ status: statusRef.current, book: book.current, columns: columns.current, events: events.current, stats: stats.current, lastMessageAt: lastMsg.current, lastUpdateId: book.current.lastUpdateId, sessionStart, tick }}>
      {children}
    </Ctx.Provider>
  );
}

export function exportColumnsCSV(cols: Column[], range = 1500) {
  const rows = ["timestamp_utc,source,symbol,mid,best_bid,best_ask,bucket_price,bid_qty,ask_qty"];
  for (const c of cols) for (const [p, v] of c.levels) if (Math.abs(p - c.mid) <= range)
    rows.push(`${new Date(c.t).toISOString()},${SOURCE.exchange},${SOURCE.symbol},${c.mid},${c.bestBid},${c.bestAsk},${p},${v.bid},${v.ask}`);
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `fzhmi_btcusdt_session_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`; a.click();
}

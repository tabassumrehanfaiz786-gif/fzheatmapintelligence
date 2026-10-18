// Pure statistics joining daily ETF flows, news sentiment and BTC returns.
// Descriptive only: correlations on ~20 trading days are weak evidence and never causal.
export const ETF_ANALYSIS_VERSION = "fzhmi-etf 1.1.0";

export const ETF_ISSUERS = [
  { key: "ibit", ticker: "IBIT", name: "BlackRock" },
  { key: "fbtc", ticker: "FBTC", name: "Fidelity" },
  { key: "gbtc", ticker: "GBTC", name: "Grayscale" },
  { key: "arkb", ticker: "ARKB", name: "ARK / 21Shares" },
  { key: "bitb", ticker: "BITB", name: "Bitwise" },
  { key: "hodl", ticker: "HODL", name: "VanEck" },
  { key: "brrr", ticker: "BRRR", name: "Valkyrie / CoinShares" },
  { key: "btco", ticker: "BTCO", name: "Invesco / Galaxy" },
  { key: "ezbc", ticker: "EZBC", name: "Franklin Templeton" },
  { key: "btcw", ticker: "BTCW", name: "WisdomTree" },
] as const;

export function researchChunks(start: string, end: string) {
  const chunks: { start: string; end: string }[] = [];
  for (let t = Date.parse(start); t <= Date.parse(end); t += 5 * 864e5) {
    chunks.push({ start: new Date(t).toISOString().slice(0, 10), end: new Date(Math.min(t + 4 * 864e5, Date.parse(end))).toISOString().slice(0, 10) });
  }
  return chunks;
}

export interface FlowRow { date: string; ibit: number | null; fbtc: number | null; gbtc: number | null; arkb: number | null; bitb: number | null; hodl?: number | null; brrr?: number | null; btco?: number | null; ezbc?: number | null; btcw?: number | null; total: number | null }
export interface NewsItem { date: string; headline: string; source: string; url: string; category: string; sentiment: number | null }
export interface DayRow { date: string; flow: number | null; sentiment: number | null; newsCount: number; ret: number | null }

export function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length; if (n < 3 || n !== ys.length) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = (xs[i] ?? 0) - mx, dy = (ys[i] ?? 0) - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}

function pairs(rows: DayRow[], a: (r: DayRow) => number | null, b: (r: DayRow) => number | null) {
  const xs: number[] = [], ys: number[] = [];
  for (const r of rows) { const x = a(r), y = b(r); if (x !== null && y !== null) { xs.push(x); ys.push(y); } }
  return { r: pearson(xs, ys), n: xs.length };
}

export function joinDays(flows: FlowRow[], news: NewsItem[], closes: Record<string, number>): DayRow[] {
  const dates = [...new Set([...flows.map((f) => f.date), ...news.map((n) => n.date)])].sort();
  const sorted = Object.keys(closes).sort();
  return dates.map((date) => {
    const f = flows.find((x) => x.date === date);
    const items = news.filter((x) => x.date === date && x.sentiment !== null);
    const i = sorted.indexOf(date);
    const previous = sorted[i - 1];
    const priorClose = previous ? closes[previous] : undefined;
    const close = closes[date];
    const ret = i > 0 && close !== undefined && priorClose ? (close / priorClose - 1) * 100 : null;
    return { date, flow: f?.total ?? null, sentiment: items.length ? items.reduce((a, b) => a + (b.sentiment ?? 0), 0) / items.length : null, newsCount: news.filter((x) => x.date === date).length, ret };
  });
}

export interface EtfStats {
  version: string; days: number; flowDays: number; missingFlowDays: number;
  flowVsReturn: { r: number | null; n: number }; flowVsNextReturn: { r: number | null; n: number };
  flowVsSentiment: { r: number | null; n: number }; sentimentVsReturn: { r: number | null; n: number };
  agreement: { same: number; n: number }; divergentDays: { date: string; flow: number; sentiment: number }[];
  netFlow: number;
}

export function etfStats(rows: DayRow[]): EtfStats {
  const next: DayRow[] = rows.map((r, i) => ({ ...r, ret: rows[i + 1]?.ret ?? null }));
  let same = 0, n = 0; const divergentDays: EtfStats["divergentDays"] = [];
  for (const r of rows) {
    if (r.flow === null || r.sentiment === null || r.flow === 0 || r.sentiment === 0) continue;
    n++;
    if (Math.sign(r.flow) === Math.sign(r.sentiment)) same++; else divergentDays.push({ date: r.date, flow: r.flow, sentiment: r.sentiment });
  }
  const flowDays = rows.filter((r) => r.flow !== null).length;
  return {
    version: ETF_ANALYSIS_VERSION, days: rows.length, flowDays, missingFlowDays: rows.length - flowDays,
    flowVsReturn: pairs(rows, (r) => r.flow, (r) => r.ret),
    flowVsNextReturn: pairs(next, (r) => r.flow, (r) => r.ret),
    flowVsSentiment: pairs(rows, (r) => r.flow, (r) => r.sentiment),
    sentimentVsReturn: pairs(rows, (r) => r.sentiment, (r) => r.ret),
    agreement: { same, n }, divergentDays,
    netFlow: rows.reduce((a, r) => a + (r.flow ?? 0), 0),
  };
}

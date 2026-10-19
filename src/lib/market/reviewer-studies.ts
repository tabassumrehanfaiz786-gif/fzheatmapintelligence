import type { Column } from "./binance-feed";

export const REVIEWER_STUDIES = [
  { id: "rapid-withdrawal", title: "A · Rapid displayed-liquidity withdrawal", question: "Does short-lived displayed size distinguish cancellation from misconduct?", limitation: "Synthetic teaching fixture, not a captured exchange event. No order identity, executions or intent.", },
  { id: "etf-dislocation", title: "B · ETF / spot–perpetual dislocation", question: "Can contemporaneous ETF flows and price divergence establish causation?", limitation: "All prices, flows and news scores in this fixture are simulated. Two observations cannot establish correlation or causation.", },
] as const;

export function reviewerColumns(id: string): Column[] {
  const start = Date.parse("2026-01-05T12:00:00Z");
  return Array.from({ length: 60 }, (_, i) => {
    const mid = id === "etf-dislocation" ? 90000 + Math.floor(i / 10) * 10 : 90000;
    const bid = id === "rapid-withdrawal" && [5, 6, 15, 16, 25, 26].includes(i) ? 20 : 0;
    return { t: start + i * 1000, mid, bestBid: mid - 1, bestAsk: mid + 1,
      levels: new Map([[89800, { bid, ask: 0 }], [mid - 20, { bid: 8, ask: 0 }], [mid + 20, { bid: 0, ask: 8 }]]) };
  });
}

export const SIMULATED_ETF_CONTEXT = [
  { date: "2026-01-05", spot: 90000, perpetual: 90030, flowUSDm: 100, newsScore: 0.4 },
  { date: "2026-01-06", spot: 90050, perpetual: 90100, flowUSDm: -50, newsScore: -0.2 },
];
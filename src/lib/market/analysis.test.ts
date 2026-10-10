import { describe, expect, it } from "vitest";
import { detectEvents, summarise, DEFAULT_PARAMS } from "./analysis";
import type { Column } from "./binance-feed";

const col = (t: number, mid: number, lv: [number, number, number][]): Column => ({ t: t * 1000, mid, bestBid: mid - 0.5, bestAsk: mid + 0.5, levels: new Map(lv.map(([p, bid, ask]) => [p, { bid, ask }])) });

describe("detectEvents", () => {
  it("classifies untouched removal as withdrawn + short-lived", () => {
    const ev = detectEvents([col(0, 1000, [[900, 0, 0]]), col(1, 1000, [[900, 20, 0]]), col(2, 1000, [[900, 0, 0]])]);
    expect(ev.map((e) => e.type)).toEqual(["added", "withdrawn", "short_lived"]);
  });
  it("classifies removal when price reaches level as consumed", () => {
    const ev = detectEvents([col(0, 1000, [[990, 20, 0]]), col(1, 990, [[990, 0, 0]])]);
    expect(ev[0]!.type).toBe("consumed");
  });
  it("flags possible relocation", () => {
    const ev = detectEvents([col(0, 1000, [[900, 20, 0], [880, 0, 0]]), col(1, 1000, [[900, 0, 0], [880, 0, 0]]), col(2, 1000, [[900, 0, 0], [880, 19, 0]])], { ...DEFAULT_PARAMS });
    expect(ev.some((e) => e.type === "possible_relocation" && e.toPrice === 880)).toBe(true);
  });
  it("ignores small changes and summarises", () => {
    const cols = [col(0, 1000, [[900, 1, 0]]), col(1, 1000, [[900, 2, 0]])];
    const ev = detectEvents(cols);
    expect(ev).toHaveLength(0);
    expect(summarise(cols, ev).seconds).toBe(1);
  });
});

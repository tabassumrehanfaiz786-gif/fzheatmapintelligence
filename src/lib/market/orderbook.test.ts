import { describe, expect, it } from "vitest";
import { OrderBook } from "./orderbook";

const snap = { lastUpdateId: 100, bids: [["99", "1"], ["98", "2"]] as [string, string][], asks: [["101", "1"], ["102", "3"]] as [string, string][] };

describe("OrderBook reconstruction", () => {
  it("drops stale events and applies the bridging event", () => {
    const ob = new OrderBook(); ob.loadSnapshot(snap);
    expect(ob.apply({ E: 0, U: 90, u: 100, b: [], a: [] })).toBe("stale");
    expect(ob.apply({ E: 0, U: 95, u: 105, b: [["99", "0"], ["100", "4"]], a: [] })).toBe("applied");
    expect(ob.bids.has(99)).toBe(false);
    expect(ob.bestBid()).toBe(100);
    expect(ob.lastUpdateId).toBe(105);
  });
  it("detects sequence gaps", () => {
    const ob = new OrderBook(); ob.loadSnapshot(snap);
    expect(ob.apply({ E: 0, U: 105, u: 110, b: [], a: [] })).toBe("gap");
    ob.apply({ E: 0, U: 101, u: 102, b: [], a: [] });
    expect(ob.apply({ E: 0, U: 104, u: 106, b: [], a: [] })).toBe("gap");
  });
  it("rejects invalid numbers", () => {
    const ob = new OrderBook(); ob.loadSnapshot(snap);
    expect(ob.apply({ E: 0, U: 101, u: 101, b: [["abc", "1"]], a: [] })).toBe("invalid");
  });
  it("computes depth and buckets", () => {
    const ob = new OrderBook(); ob.loadSnapshot(snap);
    expect(ob.depthWithin(2.5)).toEqual({ bid: 3, ask: 4 });
    expect(ob.bucket(10).get(90)).toEqual({ bid: 3, ask: 0 });
  });
});

import { describe, expect, it } from "vitest";
import { bucketDepth, parseAggTrade } from "./dualbook";

describe("dualbook", () => {
  it("buckets depth and rejects crossed books", () => {
    const c = bucketDepth({ bids: [["105", "1"], ["101", "2"]], asks: [["106", "3"], ["112", "1"]] }, 10, 0)!;
    expect(c.mid).toBe(105.5);
    expect(c.levels.get(100)).toEqual({ bid: 3, ask: 3 });
    expect(c.levels.get(110)).toEqual({ bid: 0, ask: 1 });
    expect(bucketDepth({ bids: [["107", "1"]], asks: [["106", "1"]] }, 10, 0)).toBeNull();
  });
  it("parses aggTrade aggressor side", () => {
    expect(parseAggTrade({ data: { e: "aggTrade", p: "100", q: "0.5", T: 1, m: true } })?.side).toBe("sell");
    expect(parseAggTrade({ e: "aggTrade", p: "100", q: "0.5", T: 1, m: false })?.side).toBe("buy");
    expect(parseAggTrade({ e: "trade" })).toBeNull();
  });
});

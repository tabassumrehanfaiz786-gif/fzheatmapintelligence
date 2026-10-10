import { describe, expect, it } from "vitest";
import { basisBps, l1Imbalance, parseBinanceBookTicker, parseBybitL1, parseOkxBbo } from "./venues";

describe("venue parsers", () => {
  it("parses Binance bookTicker", () => {
    expect(parseBinanceBookTicker({ b: "100", B: "2", a: "101", A: "1" })).toEqual({ bid: 100, bidQty: 2, ask: 101, askQty: 1 });
  });
  it("rejects crossed quotes", () => {
    expect(parseBinanceBookTicker({ b: "102", B: "2", a: "101", A: "1" })).toBeNull();
  });
  it("parses Bybit orderbook.1 and ignores pong", () => {
    expect(parseBybitL1({ topic: "orderbook.1.BTCUSDT", data: { b: [["100", "1"]], a: [["100.5", "3"]] } })?.ask).toBe(100.5);
    expect(parseBybitL1({ op: "pong" })).toBeNull();
  });
  it("parses OKX bbo-tbt", () => {
    expect(parseOkxBbo({ arg: { channel: "bbo-tbt" }, data: [{ bids: [["99", "1", "0", "1"]], asks: [["100", "1", "0", "1"]] }] })?.bid).toBe(99);
  });
  it("computes basis and imbalance", () => {
    const spot = { bid: 99, bidQty: 1, ask: 101, askQty: 1 }, perp = { bid: 100, bidQty: 3, ask: 102, askQty: 1 };
    expect(basisBps(perp, spot)).toBeCloseTo(100);
    expect(l1Imbalance(perp)).toBeCloseTo(0.5);
  });
});

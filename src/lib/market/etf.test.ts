import { describe, expect, it } from "vitest";
import { etfStats, joinDays, pearson } from "./etf";

describe("etf stats", () => {
  it("pearson basics", () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(pearson([1, 2], [1, 2])).toBeNull();
  });
  it("joins days and counts agreement/divergence", () => {
    const flows = ["2026-01-02", "2026-01-03", "2026-01-04"].map((date, i) => ({ date, ibit: null, fbtc: null, gbtc: null, arkb: null, bitb: null, total: [100, -50, 20][i]! }));
    const news = [
      { date: "2026-01-02", headline: "a", source: "s", url: "u", category: "c", sentiment: 0.5 },
      { date: "2026-01-03", headline: "b", source: "s", url: "u", category: "c", sentiment: 0.4 },
    ];
    const rows = joinDays(flows, news, { "2026-01-01": 100, "2026-01-02": 101, "2026-01-03": 99, "2026-01-04": 100 });
    expect(rows[0]!.ret).toBeCloseTo(1);
    const s = etfStats(rows);
    expect(s.agreement).toEqual({ same: 1, n: 2 });
    expect(s.divergentDays[0]!.date).toBe("2026-01-03");
    expect(s.netFlow).toBe(70);
  });
});

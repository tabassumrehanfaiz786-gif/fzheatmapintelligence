import { describe, it, expect } from "vitest";
import { webcrypto } from "node:crypto";
import { DEFAULT_PARAMS, detectEvents } from "./analysis";
import { assessEvidence, analysisPayload, evidenceBundle, verifyBundle, sha256 } from "./evidence";
import { reviewerColumns, SIMULATED_ETF_CONTEXT } from "./reviewer-studies";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
describe("research evidence rules", () => {
  it("does not infer an actor or intent from three simulated withdrawals", () => {
    const columns = reviewerColumns("rapid-withdrawal");
    const a = assessEvidence(columns, detectEvents(columns));
    expect(a.indicators.find(i => i.name === "Short-lived displayed liquidity")?.observed).toBe(3);
    expect(a.alternatives.find(i => i.name === "Delta-neutral hedging")?.status).toBe("Not testable");
  });
  it("labels teaching data as simulated and preserves ETF context", () => {
    const p = analysisPayload(reviewerColumns("etf-dislocation"), DEFAULT_PARAMS, "fixture", true, SIMULATED_ETF_CONTEXT);
    expect(p.simulated).toBe(true);
    expect(p.context).toEqual(SIMULATED_ETF_CONTEXT);
    expect(p.columns).toHaveLength(60);
  });
  it("hashes key order consistently", async () => {
    expect(await sha256({ a: 1, b: 2 })).toBe(await sha256({ b: 2, a: 1 }));
  });
  it("detects tampering with recorded data", async () => {
    const b = await evidenceBundle(analysisPayload(reviewerColumns("rapid-withdrawal"), DEFAULT_PARAMS, "fixture", true));
    expect(await verifyBundle(b)).toBe(true);
    b.payload.columns[0] && (b.payload.columns[0].mid += 1);
    expect(await verifyBundle(b)).toBe(false);
  });
  it("detects tampering with parameter hashes", async () => {
    const b = await evidenceBundle(analysisPayload([], DEFAULT_PARAMS, "empty"));
    b.manifest.params_sha256 = "bad";
    expect(await verifyBundle(b)).toBe(false);
  });
});
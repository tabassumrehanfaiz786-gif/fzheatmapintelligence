import { ANALYSIS_VERSION, detectEvents, summarise, type Params, type LiquidityEvent } from "./analysis";
import type { Column } from "./binance-feed";

export const EVIDENCE_VERSION = "fzhmi-evidence 1.0.0";
export function assessEvidence(columns: Column[], events: LiquidityEvent[]) {
  const summary = summarise(columns, events);
  const withdrawals = events.filter(e => e.type === "withdrawn");
  const follow = withdrawals.filter(e => {
    const i = columns.findIndex(c => c.t === e.t);
    const before = columns[i - 1], after = columns[i];
    return before && after && Math.abs(after.mid - before.mid) > 0;
  }).length;
  return {
    indicators: [
      { name: "Short-lived displayed liquidity", observed: summary.counts.short_lived, missing: "Order-level duration, trader identity and intent" },
      { name: "Repeated level changes", observed: summary.flickerLevels.length, missing: "Individual order sequence and actual executions" },
      { name: "Untouched size reductions", observed: summary.counts.withdrawn, missing: "Trade matching; cancellation is inferred, not verified" },
      { name: "Possible relocation", observed: summary.counts.possible_relocation, missing: "Same-order or same-participant linkage" },
    ],
    alternatives: [
      { name: "Price-following quote updates", status: withdrawals.length ? `${follow}/${withdrawals.length} withdrawals coincide with a sampled mid-price change` : "No withdrawals to assess", evidence: "Single-venue temporal co-occurrence only; not a causal test." },
      { name: "Cross-venue latency arbitrage", status: "Not testable", evidence: "Needs synchronised venue quotes, exchange timestamps and execution records." },
      { name: "Delta-neutral hedging", status: "Not testable", evidence: "Needs linked spot/perpetual fills and participant positions." },
      { name: "Inventory risk mitigation", status: "Not testable", evidence: "Needs inventory, risk limits and participant records." },
    ],
    gaps: summary.gaps,
    conclusion: "Displayed-book indicators only. No legal element, intent or misconduct is established.",
  };
}

export function canonicalJSON(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).filter(k => obj[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canonicalJSON(obj[k])}`).join(",")}}`;
}
export async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(canonicalJSON(value));
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
}
export function analysisPayload(columns: Column[], params: Params, source: string, simulated = false, context: unknown = null) {
  const events = detectEvents(columns, params);
  return { schema: EVIDENCE_VERSION, software: ANALYSIS_VERSION, source, simulated, context, params,
    columns: columns.map(c => ({ ...c, levels: [...c.levels].sort(([a], [b]) => a - b) })),
    events, summary: summarise(columns, events), assessment: assessEvidence(columns, events),
    limitations: ["Bucketed browser-receive-time depth, not raw exchange ticks.", "Sequence IDs, original messages and authenticated timestamps were not recorded.", "SHA-256 checks content consistency only; no proof of origin, completeness or legal admissibility."] };
}
export type AnalysisPayload = ReturnType<typeof analysisPayload>;
export async function evidenceBundle(payload: AnalysisPayload) {
  return { payload, manifest: { algorithm: "SHA-256", canonicalization: "Sorted object keys; array order preserved; JSON number encoding v1", payload_sha256: await sha256(payload), params_sha256: await sha256(payload.params), exported_at: new Date().toISOString() } };
}
export async function verifyBundle(input: unknown): Promise<boolean> {
  if (!input || typeof input !== "object") return false;
  const v = input as { payload?: unknown; manifest?: { payload_sha256?: string; params_sha256?: string } };
  if (!v.payload || !v.manifest?.payload_sha256 || !v.manifest.params_sha256) return false;
  const params = (v.payload as { params?: unknown }).params;
  return await sha256(v.payload) === v.manifest.payload_sha256 && await sha256(params) === v.manifest.params_sha256;
}

export function researchMemo(payload: AnalysisPayload, format: "stor" | "academic", notes: string) {
  const title = format === "stor" ? "STOR-style research draft — NOT FOR SUBMISSION" : "Academic evidence memorandum — NOT AN EXPERT REPORT";
  return `# ${title}\n\nSource: ${payload.source}\nData: ${payload.simulated ? "SIMULATED teaching fixture" : "Observed bucketed depth"}\nSoftware: ${payload.software}; ${payload.schema}\n\n## 1. Research scope\n${payload.columns.length} columns; ${payload.summary.seconds}s; ${payload.summary.gaps} gaps. Instrument: BTCUSDT.\n\n## 2. Factual observations\n${payload.assessment.indicators.map(i => `- ${i.name}: ${i.observed}. Missing: ${i.missing}.`).join("\n")}\n\n## 3. Alternative explanations\n${payload.assessment.alternatives.map(a => `- ${a.name}: ${a.status}. ${a.evidence}`).join("\n")}\n\n## 4. Legal scope\nMAR application depends on instrument and venue. MiCA has its own crypto-asset market-abuse scope. FCA v Da Vinci Invest concerned different facts and instruments; this is not its judicial test. Consult the official references shown in FZ HMI.\n\n## 5. Researcher's annotations\n${notes || "Not supplied."}\n\n## 6. Further evidence needed\nTrader identity, order/execution audit trail, positions, synchronised venues, jurisdiction and instrument classification, corroborating communications.\n\n## 7. Evidentiary reservations\n${payload.assessment.conclusion}\n${payload.limitations.join("\n")}\n\n## 8. Human review\n${format === "stor" ? "Reporting entity, person/instrument identification, grounds for suspicion and official form requirements need review by an authorised reporter. This app does not submit reports." : "No expert qualifications, independence declaration or statement of truth is generated. CPR Part 35 compliance requires a qualified expert and case-specific review."}\n`;
}
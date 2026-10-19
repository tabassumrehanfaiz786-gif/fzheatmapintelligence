import { useMemo, useState } from "react";
import { Download, Fingerprint, FileText, ShieldCheck } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { useDataSource, SourcePicker, ParamsEditor } from "./DataSource";
import { Heatmap } from "./Heatmap";
import { DEFAULT_PARAMS, download } from "@/lib/market/analysis";
import { analysisPayload, evidenceBundle, verifyBundle, researchMemo } from "@/lib/market/evidence";
import { REVIEWER_STUDIES, reviewerColumns, SIMULATED_ETF_CONTEXT } from "@/lib/market/reviewer-studies";
import { LegalReferences } from "./LegalReferences";

export function EvidenceWorkbench() {
  const ds = useDataSource();
  const [study, setStudy] = useState("rapid-withdrawal");
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [notes, setNotes] = useState("");
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof evidenceBundle>> | null>(null);
  const [status, setStatus] = useState("");
  const [format, setFormat] = useState<"stor" | "academic">("academic");
  const [preview, setPreview] = useState(false);
  const fixture = REVIEWER_STUDIES.find(s => s.id === study);
  const columns = useMemo(() => fixture ? reviewerColumns(study) : ds.columns, [study, ds.columns, ds.tick]);
  const payload = useMemo(() => analysisPayload(columns, params, fixture ? `SIMULATED · ${fixture.title}` : `Binance Spot BTCUSDT · ${ds.sel}`, !!fixture, study === "etf-dislocation" ? SIMULATED_ETF_CONTEXT : null), [columns, params, study, ds.sel]);
  const frozen = bundle?.payload ?? payload;
  const memo = researchMemo(frozen, format, notes);
  const invalidate = () => { setBundle(null); setStatus(""); };
  return <section className="mt-5 min-w-0 space-y-4 border-t pt-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Evidence & legal research</h2><span className="label-caps text-warn">Research only · no misconduct findings</span></div>
    <label className="block text-xs text-muted-foreground">Research dataset
      <select aria-label="Research dataset" value={study} onChange={e => { setStudy(e.target.value); invalidate(); }} className="mt-1 w-full rounded-sm border bg-background p-2 text-foreground">
        {REVIEWER_STUDIES.map(s => <option key={s.id} value={s.id}>{s.title} · SIMULATED</option>)}
        <option value="observed">Live / private recorded depth</option>
      </select></label>
    {fixture ? <div className="border-l-2 border-warn pl-3 text-sm"><p className="font-medium">SIMULATED · {fixture.question}</p><p className="mt-1 text-xs text-muted-foreground">{fixture.limitation}</p></div> : <SourcePicker ds={ds} />}
    <ParamsEditor p={params} onChange={p => { setParams(p); invalidate(); }} />
    <Heatmap columns={columns} range={300} seconds={Math.max(60, Math.min(columns.length, 600))} tick={ds.tick + (fixture ? study.length : 0)} />
    {study === "etf-dislocation" && <div className="overflow-x-auto"><table className="w-full text-left font-mono text-xs"><caption className="py-2 text-left text-warn">SIMULATED ETF context · n=2 · no inferential statistics</caption><thead><tr><th>Date</th><th>Spot $</th><th>Perp $</th><th>Flow $m</th><th>News score</th></tr></thead><tbody>{SIMULATED_ETF_CONTEXT.map(r => <tr key={r.date} className="border-t"><td className="py-2">{r.date}</td><td>{r.spot}</td><td>{r.perpetual}</td><td>{r.flowUSDm}</td><td>{r.newsScore}</td></tr>)}</tbody></table></div>}
    <div className="overflow-x-auto"><table className="w-full text-left text-xs"><caption className="pb-2 text-left font-semibold">Observed indicator matrix · not a statutory test</caption><thead className="text-muted-foreground"><tr><th className="pb-2">Indicator</th><th className="px-3">Count</th><th>Evidence still needed</th></tr></thead><tbody>{payload.assessment.indicators.map(i => <tr key={i.name} className="border-t"><td className="py-3">{i.name}</td><td className="px-3 font-mono">{i.observed}</td><td>{i.missing}</td></tr>)}</tbody></table></div>
    <div className="space-y-3"><h3 className="font-semibold">Alternative explanations</h3>{payload.assessment.alternatives.map(a => <div key={a.name} className="border-l pl-3 text-xs"><div className="font-medium">{a.name} · {a.status}</div><p className="mt-1 text-muted-foreground">{a.evidence}</p></div>)}</div>
    <LegalReferences />
    <label className="block text-xs text-muted-foreground">Research annotations<textarea aria-label="Research annotations" rows={3} value={notes} onChange={e => setNotes(e.target.value)} className="mt-1 w-full rounded-sm border bg-background p-2 text-foreground" /></label>
    <div className="space-y-2 border-t pt-4"><h3 className="flex items-center gap-2 font-semibold"><Fingerprint className="size-4" />Content provenance</h3><p className="text-xs text-muted-foreground">Hashes cover exported bucketed depth and analysis, not original exchange messages. They do not certify origin, completeness or admissibility.</p>
      <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={!columns.length || ds.loading} onClick={async () => { try { setBundle(await evidenceBundle(payload)); setStatus("Analysis frozen and hashed. Downloads use this snapshot."); } catch { setStatus("Unable to hash this analysis."); } }}><Fingerprint />Freeze & hash analysis</Button>
      <Button variant="outline" size="sm" disabled={!bundle} onClick={() => bundle && download("fzhmi-evidence.json", JSON.stringify(bundle, null, 2), "application/json")}><Download />Download evidence bundle</Button>
      <label className="flex items-center gap-2 text-xs"><ShieldCheck className="size-4" />Verify bundle<input aria-label="Verify evidence bundle" type="file" accept="application/json,.json" className="max-w-48 text-xs" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; try { setStatus(await verifyBundle(JSON.parse(await file.text())) ? "MATCH: payload and parameter hashes verified." : "MISMATCH: content or hashes differ."); } catch { setStatus("Invalid evidence bundle."); } e.target.value = ""; }} /></label></div>
      {bundle && <p className="break-all font-mono text-xs text-live">SHA-256 {bundle.manifest.payload_sha256}</p>}{status && <p role="status" className="text-xs text-muted-foreground">{status}</p>}
    </div>
    <div className="flex flex-wrap items-center gap-2 border-t pt-4"><select aria-label="Memorandum format" value={format} onChange={e => setFormat(e.target.value === "stor" ? "stor" : "academic")} className="max-w-full rounded-sm border bg-background p-2 text-xs"><option value="academic">Academic memorandum · not an expert report</option><option value="stor">STOR-style draft · not for submission</option></select><Button variant="outline" size="sm" onClick={() => setPreview(!preview)}><FileText />{preview ? "Close preview" : "Preview memorandum"}</Button><Button variant="outline" size="sm" onClick={() => download(`fzhmi-${format}-research.md`, memo, "text/markdown;charset=utf-8")}><Download />Export memorandum</Button></div>
    {preview && <article className="research-markdown min-w-0 border-t pt-4"><ReactMarkdown>{memo}</ReactMarkdown></article>}
  </section>;
}
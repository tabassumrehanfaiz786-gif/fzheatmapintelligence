import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, StatusBadge } from "@/components/AppShell";
import { ParamsEditor } from "@/components/DataSource";
import { ANALYSIS_VERSION, DEFAULT_PARAMS, detectEvents, download, summarise, type Params, type Summary } from "@/lib/market/analysis";
import { listSessions, loadSessionColumns, type RecordingSession } from "@/lib/market/recorder";
import { createProject, deleteProject, listProjects, updateProject, type Project } from "@/lib/research";

export const Route = createFileRoute("/studio")({
  head: () => ({ meta: [
    { title: "Research Studio · Fz Heat Map Intelligence" },
    { name: "description", content: "Saved research projects: questions, hypotheses, recorded sessions, reproducible parameters, results and sensitivity analysis." },
    { property: "og:title", content: "Research Studio · FZ HMI" },
    { property: "og:description", content: "Reproducible order-book research projects with saved parameters and results." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: StudioPage,
});

interface Results { summary: Summary; sensitivity: { minQty: number; counts: Summary["counts"] }[]; run_utc: string; session: { id: string; started_at: string; columns: number } }

function StudioPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<RecordingSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const refresh = () => listProjects().then(setProjects).catch((e) => setErr(e.message));
  useEffect(() => { refresh(); listSessions().then(setSessions).catch(() => {}); }, []);
  const active = projects.find((p) => p.id === activeId) ?? null;

  return (
    <>
      <PageHeader title="Research Studio" sub="Write down a research question, link it to a recorded session, run the event analysis with saved settings, and keep the results you can reproduce." badge={<StatusBadge s="Implemented" />} />
      {err && <p className="mb-3 text-xs text-destructive">{err}</p>}
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <div className="panel p-3">
          <button onClick={async () => { const p = await createProject("Untitled study"); await refresh(); setActiveId(p.id); }} className="mb-3 w-full rounded-sm border border-primary px-2 py-1.5 text-sm text-primary">+ New project</button>
          {!projects.length && <p className="text-xs text-muted-foreground">No projects yet.</p>}
          <ul className="space-y-1">{projects.map((p) => (
            <li key={p.id}><button onClick={() => setActiveId(p.id)} className={`w-full rounded-sm px-2 py-1.5 text-left text-sm ${p.id === activeId ? "bg-accent" : "hover:bg-accent"}`}>
              {p.title}<div className="text-[0.7rem] text-muted-foreground">{p.results ? "has results" : "no run yet"} · {new Date(p.updated_at).toISOString().slice(0, 10)}</div></button></li>))}</ul>
        </div>
        {active ? <Editor key={active.id} p={active} sessions={sessions} onSaved={refresh} onDelete={async () => { await deleteProject(active.id); setActiveId(null); refresh(); }} /> :
          <div className="panel p-6 text-sm text-muted-foreground">Pick a project or create one. To analyse a session, first record one on the Live Heatmap page.</div>}
      </div>
    </>
  );
}

function Editor({ p, sessions, onSaved, onDelete }: { p: Project; sessions: RecordingSession[]; onSaved: () => void; onDelete: () => void }) {
  const [f, setF] = useState({ title: p.title, question: p.question, hypothesis: p.hypothesis, notes: p.notes, session_id: p.session_id ?? "" });
  const [params, setParams] = useState<Params>({ ...DEFAULT_PARAMS, ...(p.params as Partial<Params>) });
  const [results, setResults] = useState<Results | null>(p.results as unknown as Results | null);
  const [busy, setBusy] = useState<string | null>(null);
  const save = async (extra: Record<string, unknown> = {}) => { setBusy("Saving…"); await updateProject(p.id, { ...f, session_id: f.session_id || null, params: params as never, ...extra }); setBusy(null); onSaved(); };
  const run = async () => {
    const s = sessions.find((x) => x.id === f.session_id); if (!s) return;
    setBusy("Running analysis…");
    const cols = await loadSessionColumns(s.id);
    const summary = summarise(cols, detectEvents(cols, params));
    const sensitivity = [0.5, 1, 2].map((k) => ({ minQty: params.minQty * k, counts: summarise(cols, detectEvents(cols, { ...params, minQty: params.minQty * k })).counts }));
    const r: Results = { summary, sensitivity, run_utc: new Date().toISOString(), session: { id: s.id, started_at: s.started_at, columns: cols.length } };
    setResults(r); await save({ results: r as never, software_version: ANALYSIS_VERSION });
  };
  const inp = "mt-1 w-full rounded-sm border bg-background px-2 py-1.5 text-sm";
  return (
    <div className="panel space-y-3 p-4">
      <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={`${inp} text-lg font-semibold`} />
      <label className="block text-xs text-muted-foreground">Research question<textarea rows={2} value={f.question} onChange={(e) => setF({ ...f, question: e.target.value })} className={inp} /></label>
      <label className="block text-xs text-muted-foreground">Testable hypothesis<textarea rows={2} value={f.hypothesis} onChange={(e) => setF({ ...f, hypothesis: e.target.value })} className={inp} /></label>
      <label className="block text-xs text-muted-foreground">Observation period (recorded session)
        <select value={f.session_id} onChange={(e) => setF({ ...f, session_id: e.target.value })} className={inp}>
          <option value="">— choose a recorded session —</option>
          {sessions.map((s) => <option key={s.id} value={s.id}>{new Date(s.started_at).toISOString().slice(0, 16).replace("T", " ")} UTC · {s.column_count} cols{s.note ? ` · ${s.note}` : ""}</option>)}
        </select></label>
      <div><div className="label-caps mb-1">Analysis parameters (saved with the project)</div><ParamsEditor p={params} onChange={setParams} /></div>
      <label className="block text-xs text-muted-foreground">Notes, alternative explanations, limitations<textarea rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className={inp} /></label>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => save()} className="rounded-sm border px-3 py-1.5 text-sm hover:bg-accent">Save</button>
        <button disabled={!f.session_id || !!busy} onClick={run} className="rounded-sm border border-primary px-3 py-1.5 text-sm text-primary disabled:opacity-40">Run analysis & save results</button>
        {results && <button onClick={() => download(`fzhmi_project_${p.id}.json`, JSON.stringify({ project: { ...f, id: p.id }, params, software: ANALYSIS_VERSION, results }, null, 2), "application/json")} className="rounded-sm border px-3 py-1.5 text-sm hover:bg-accent">Export reproducible JSON</button>}
        <button onClick={onDelete} className="ml-auto rounded-sm border px-3 py-1.5 text-sm text-destructive">Delete</button>
        {busy && <span className="self-center text-xs text-muted-foreground">{busy}</span>}
      </div>
      {results && (
        <div className="rounded-sm border p-3 text-xs">
          <div className="label-caps mb-2">Results · run {results.run_utc.slice(0, 19).replace("T", " ")} UTC · {p.software_version ?? ANALYSIS_VERSION}</div>
          <p className="mb-2 text-muted-foreground">Sample: {results.summary.columns} columns ({results.summary.seconds.toFixed(0)} s), {results.summary.gaps} missing-data gaps.</p>
          <table className="w-full font-mono"><thead className="text-left text-muted-foreground"><tr><th>Min size (BTC)</th><th className="text-right">Added</th><th className="text-right">Consumed</th><th className="text-right">Withdrawn</th><th className="text-right">Relocation?</th><th className="text-right">Short-lived</th></tr></thead>
            <tbody>{results.sensitivity.map((r) => <tr key={r.minQty} className="border-t"><td>{r.minQty}</td><td className="text-right">{r.counts.added}</td><td className="text-right">{r.counts.consumed}</td><td className="text-right">{r.counts.withdrawn}</td><td className="text-right">{r.counts.possible_relocation}</td><td className="text-right">{r.counts.short_lived}</td></tr>)}</tbody></table>
          <p className="mt-2 text-muted-foreground">The sensitivity rows rerun the analysis at half and double the size threshold. If a result only appears at one setting, it is weak.</p>
        </div>)}
    </div>
  );
}

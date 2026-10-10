import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, StatusBadge } from "@/components/AppShell";
import { SourcePicker, useDataSource } from "@/components/DataSource";
import { ANALYSIS_VERSION, DEFAULT_PARAMS, detectEvents, summarise } from "@/lib/market/analysis";
import { listProjects, type Project } from "@/lib/research";
import { askAssistant } from "@/lib/assistant.functions";

export const Route = createFileRoute("/assistant")({
  head: () => ({ meta: [
    { title: "AI Research Assistant · Fz Heat Map Intelligence" },
    { name: "description", content: "Ask questions about recorded order-book sessions and research projects; answers grounded in your data with limitations stated." },
    { property: "og:title", content: "AI Research Assistant · FZ HMI" },
    { property: "og:description", content: "A cautious AI assistant grounded in your recorded order-book data." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AssistantPage,
});

type Msg = { role: "user" | "assistant"; content: string };
const PROMPTS = ["Summarise the most notable liquidity events in this data.", "Explain how 'withdrawn' differs from 'consumed' and the limitations.", "What alternative explanations exist for the short-lived orders?", "Suggest three testable hypotheses from this data.", "What data is missing to strengthen these observations?"];

function AssistantPage() {
  const ds = useDataSource();
  const ask = useServerFn(askAssistant);
  const [projects, setProjects] = useState<Project[]>([]);
  const [pid, setPid] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { listProjects().then(setProjects).catch(() => {}); }, []);

  const context = useMemo(() => {
    if (ds.columns.length < 2) return "";
    const ev = detectEvents(ds.columns, DEFAULT_PARAMS), s = summarise(ds.columns, ev);
    const proj = projects.find((p) => p.id === pid);
    return JSON.stringify({
      source: ds.isLive ? "live rolling buffer, Binance spot BTCUSDT" : `recorded session ${ds.sel}`, software: ANALYSIS_VERSION, params: DEFAULT_PARAMS,
      window_utc: [new Date(ds.columns[0]!.t).toISOString(), new Date(ds.columns.at(-1)!.t).toISOString()],
      mid_start: ds.columns[0]!.mid, mid_end: ds.columns.at(-1)!.mid, summary: s,
      largest_events: [...ev].sort((a, b) => b.qty - a.qty).slice(0, 25).map((e) => ({ id: e.id, type: e.type, t: new Date(e.t).toISOString(), side: e.side, price: e.price, qty: +e.qty.toFixed(2), distance: +e.distance.toFixed(0), lifetime: e.lifetime, to: e.toPrice })),
      project: proj ? { title: proj.title, question: proj.question, hypothesis: proj.hypothesis, notes: proj.notes, results: proj.results } : null,
    });
  }, [ds.columns.length, ds.sel, pid, projects]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const next = [...msgs, { role: "user" as const, content: text }];
    setMsgs(next); setInput(""); setBusy(true); setErr(null);
    try { const r = await ask({ data: { messages: next, context } }); if ("error" in r && r.error) setErr(r.error); else setMsgs([...next, { role: "assistant", content: r.reply ?? "" }]); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="AI Research Assistant" sub="Ask questions about your data. Answers are based on the selected session's event summary and are told to state limitations and never claim manipulation is proven." badge={<StatusBadge s="Implemented" />} />
      <div className="panel mb-4 flex flex-wrap items-center gap-4 p-3 text-xs">
        <SourcePicker ds={ds} />
        <label className="flex items-center gap-2"><span className="label-caps">Project</span>
          <select value={pid} onChange={(e) => setPid(e.target.value)} className="rounded-sm border bg-background px-2 py-1"><option value="">none</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
        <span className="text-muted-foreground">{context ? `Context: ${ds.columns.length} columns analysed` : "No data yet"}</span>
      </div>
      <div className="panel flex min-h-[420px] flex-col p-3">
        <div className="flex-1 space-y-3 overflow-auto">
          {!msgs.length && <div className="flex flex-wrap gap-2">{PROMPTS.map((q) => <button key={q} onClick={() => send(q)} disabled={!context} className="rounded-sm border px-2 py-1 text-left text-xs hover:bg-accent disabled:opacity-40">{q}</button>)}</div>}
          {msgs.map((m, i) => <div key={i} className={`whitespace-pre-wrap rounded-sm border p-3 text-sm ${m.role === "user" ? "ml-auto max-w-[80%] border-primary/50" : "max-w-[95%]"}`}>{m.content}</div>)}
          {busy && <div className="text-xs text-muted-foreground">Thinking…</div>}
          {err && <div className="text-xs text-destructive">{err}</div>}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mt-3 flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={context ? "Ask about this data…" : "Waiting for data…"} className="flex-1 rounded-sm border bg-background px-3 py-2 text-sm" />
          <button disabled={busy || !context} className="rounded-sm border border-primary px-4 text-sm text-primary disabled:opacity-40">Send</button>
        </form>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">AI can make mistakes. Check every claim against the exported data. This is not trading or legal advice.</p>
    </>
  );
}

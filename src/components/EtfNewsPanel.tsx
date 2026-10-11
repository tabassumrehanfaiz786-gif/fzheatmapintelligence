import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/auth";
import { explainAndSave, fetchEtfFlows, fetchEtfNews } from "@/lib/etf.functions";
import { etfStats, joinDays, type EtfStats, type FlowRow, type NewsItem } from "@/lib/market/etf";
import { download } from "@/lib/market/analysis";

interface Saved { id: string; created_at: string; period_start: string; period_end: string; explanation: string; stats: unknown; flows: unknown; news: unknown; sources: unknown }
const iso = (d: Date) => d.toISOString().slice(0, 10);
const fmtR = (x: { r: number | null; n: number }) => (x.r === null ? `n/a (n=${x.n})` : `${x.r.toFixed(2)} (n=${x.n})`);

async function btcCloses(): Promise<Record<string, number>> {
  const r = await fetch("https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=40");
  const k = (await r.json()) as [number, string, string, string, string][];
  return Object.fromEntries(k.map((x) => [iso(new Date(x[0])), Number(x[4])]));
}

export function EtfNewsPanel() {
  const user = useUser();
  const f1 = useServerFn(fetchEtfFlows), f2 = useServerFn(fetchEtfNews), f3 = useServerFn(explainAndSave);
  const [step, setStep] = useState<string | null>(null), [err, setErr] = useState<string | null>(null);
  const [flows, setFlows] = useState<FlowRow[]>([]), [news, setNews] = useState<NewsItem[]>([]);
  const [stats, setStats] = useState<EtfStats | null>(null), [rows, setRows] = useState<ReturnType<typeof joinDays>>([]);
  const [explanation, setExplanation] = useState(""), [sources, setSources] = useState<string[]>([]);
  const [saved, setSaved] = useState<Saved[]>([]);

  async function loadSaved() {
    const { data } = await supabase.from("etf_news_analyses").select("*").order("created_at", { ascending: false }).limit(30);
    setSaved((data ?? []) as Saved[]);
  }
  useEffect(() => { if (user) loadSaved(); }, [user]);

  async function run() {
    setErr(null); setExplanation("");
    const end = new Date(), start = new Date(Date.now() - 30 * 864e5);
    const period = { start: iso(start), end: iso(end) };
    try {
      setStep("Looking up ETF flows and news (about 1 minute)…");
      const [fl, nw, closes] = await Promise.all([f1({ data: period }), f2({ data: period }), btcCloses()]);
      const fr = fl.rows.filter((r) => r.date >= period.start).sort((a, b) => a.date.localeCompare(b.date));
      const nr = nw.items.filter((n) => n.date >= period.start && n.date <= period.end);
      const jd = joinDays(fr, nr, closes), st = etfStats(jd);
      setFlows(fr); setNews(nr); setRows(jd); setStats(st); setSources(fl.sources);
      setStep("AI is analysing and saving to your research…");
      const daily = jd.map((r) => `${r.date}, ${r.flow ?? "NA"}, ${r.sentiment?.toFixed(2) ?? "NA"}, ${r.ret?.toFixed(2) ?? "NA"}`).join("\n");
      const res = await f3({ data: { period, flows: fr, news: nr, stats: st as unknown as Record<string, unknown>, sources: fl.sources.slice(0, 40), daily } });
      setExplanation(res.explanation); await loadSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setStep(null);
  }

  function open(s: Saved) {
    const fr = s.flows as FlowRow[], nr = s.news as NewsItem[];
    setFlows(fr); setNews(nr); setStats(s.stats as EtfStats); setExplanation(s.explanation); setSources(s.sources as string[]);
    setRows(joinDays(fr, nr, {}));
  }

  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.flow ?? 0)));

  return (
    <div className="panel mt-4 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="label-caps text-foreground">Spot bitcoin ETF flows × news · last 30 days</div>
          <p className="text-xs text-muted-foreground">BlackRock IBIT, Fidelity FBTC, Grayscale GBTC, ARK ARKB, Bitwise BITB. Figures are looked up from published sources (links below) — verify before citing.</p>
        </div>
        {user ? <button disabled={!!step} onClick={run} className="rounded-sm bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">{step ? "Working…" : "Run & record analysis"}</button>
          : user === null && <Link to="/auth" className="rounded-sm border px-3 py-1.5 text-xs">Sign in to run & record</Link>}
      </div>
      {step && <p className="text-xs text-warn">{step}</p>}
      {err && <p className="text-xs text-destructive">{err}</p>}

      {rows.length > 0 && (
        <div className="mt-2 grid gap-3 lg:grid-cols-2">
          <div>
            <div className="label-caps mb-1">Daily total net flow ($M) and news sentiment</div>
            <div className="space-y-0.5 font-mono text-[0.68rem]">
              {rows.map((r) => (
                <div key={r.date} className="grid grid-cols-[70px_1fr_44px_50px] items-center gap-2">
                  <span className="text-muted-foreground">{r.date.slice(5)}</span>
                  <div className="relative h-3 bg-muted/30">
                    {r.flow !== null && <div className={`absolute top-0 h-3 ${r.flow >= 0 ? "left-1/2 bg-bid" : "right-1/2 bg-ask"}`} style={{ width: `${(Math.abs(r.flow) / maxAbs) * 50}%` }} />}
                  </div>
                  <span className={r.flow === null ? "text-muted-foreground" : r.flow >= 0 ? "text-bid" : "text-ask"}>{r.flow === null ? "—" : r.flow.toFixed(0)}</span>
                  <span className={r.sentiment === null ? "text-muted-foreground" : r.sentiment >= 0 ? "text-bid" : "text-ask"}>{r.sentiment === null ? "—" : `${r.sentiment > 0 ? "+" : ""}${r.sentiment.toFixed(2)}`}</span>
                </div>
              ))}
            </div>
          </div>
          {stats && (
            <div className="space-y-1 text-xs">
              <div className="label-caps">Correlation (descriptive, not causal)</div>
              <div>Net flow over period: <b className="font-mono">${stats.netFlow.toFixed(0)}M</b> · {stats.flowDays} days with flow data, {stats.missingFlowDays} missing</div>
              <div>Flow vs same-day BTC return: <span className="font-mono">{fmtR(stats.flowVsReturn)}</span></div>
              <div>Flow vs next-day BTC return: <span className="font-mono">{fmtR(stats.flowVsNextReturn)}</span></div>
              <div>Flow vs news sentiment: <span className="font-mono">{fmtR(stats.flowVsSentiment)}</span></div>
              <div>News sentiment vs BTC return: <span className="font-mono">{fmtR(stats.sentimentVsReturn)}</span></div>
              <div>Flow and news pointed the same way on <b>{stats.agreement.same}/{stats.agreement.n}</b> days. Diverged on: {stats.divergentDays.map((d) => d.date.slice(5)).join(", ") || "none"}</div>
              <p className="text-muted-foreground">With fewer than ~30 points these correlations are very uncertain. Flows are reported after US market close, so same-day comparisons mix timing.</p>
            </div>
          )}
        </div>
      )}

      {explanation && <div className="prose prose-sm prose-invert mt-3 max-w-none rounded-sm border p-3 text-sm"><div className="label-caps mb-1 not-prose">AI explanation (hypotheses, not proof)</div><ReactMarkdown>{explanation}</ReactMarkdown></div>}

      {news.length > 0 && (
        <details className="mt-3 text-xs"><summary className="cursor-pointer label-caps">News used ({news.length})</summary>
          <ul className="mt-1 space-y-1">{news.map((n, i) => <li key={i}><span className="font-mono text-muted-foreground">{n.date}</span> <a href={n.url} target="_blank" rel="noreferrer" className="underline">{n.headline}</a> <span className="text-muted-foreground">· {n.source} · {n.category} · {n.sentiment ?? "?"}</span></li>)}</ul>
        </details>)}
      {flows.length > 0 && (
        <details className="mt-2 text-xs"><summary className="cursor-pointer label-caps">Flows by issuer ($M) & sources</summary>
          <table className="mt-1 w-full font-mono"><thead className="text-muted-foreground"><tr><th className="text-left">Date</th><th>IBIT</th><th>FBTC</th><th>GBTC</th><th>ARKB</th><th>BITB</th><th>Total</th></tr></thead>
            <tbody>{flows.map((f) => <tr key={f.date} className="text-center"><td className="text-left">{f.date}</td>{[f.ibit, f.fbtc, f.gbtc, f.arkb, f.bitb, f.total].map((v, i) => <td key={i}>{v ?? "—"}</td>)}</tr>)}</tbody></table>
          <ul className="mt-1">{sources.map((s) => <li key={s}><a className="underline" href={s} target="_blank" rel="noreferrer">{s}</a></li>)}</ul>
        </details>)}

      {user && saved.length > 0 && (
        <div className="mt-3 border-t pt-2">
          <div className="label-caps mb-1">Recorded analyses</div>
          <ul className="space-y-1 text-xs">{saved.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2">
              <span className="font-mono">{new Date(s.created_at).toISOString().slice(0, 16).replace("T", " ")}Z</span>
              <span className="text-muted-foreground">{s.period_start} → {s.period_end}</span>
              <button className="underline" onClick={() => open(s)}>Open</button>
              <button className="underline" onClick={() => download(`fzhmi_etf_news_${s.period_end}.json`, JSON.stringify(s, null, 2), "application/json")}>Export JSON</button>
              <button className="text-destructive underline" onClick={async () => { await supabase.from("etf_news_analyses").delete().eq("id", s.id); loadSaved(); }}>Delete</button>
            </li>))}</ul>
        </div>)}
    </div>
  );
}

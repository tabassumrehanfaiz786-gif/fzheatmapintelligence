import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ETF_ISSUERS, type FlowRow } from "@/lib/market/etf";

const PARALLEL = "https://connector-gateway.lovable.dev/parallel/v1/responses";
const num = { type: ["number", "null"] };
const str = { type: "string" };

async function parallel(input: string, schema: Record<string, unknown>) {
  const lk = process.env["LOVABLE_API_KEY"], pk = process.env["PARALLEL_API_KEY"];
  if (!lk || !pk) throw new Error("Research service is not configured.");
  const r = await fetch(PARALLEL, {
    method: "POST",
    headers: { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": pk, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "parallel", reasoning: { effort: "medium" }, input, text: { format: { type: "json_schema", name: "out", schema } } }),
  });
  const body = await r.text();
  if (!r.ok) { console.error("parallel", r.status, body); throw new Error(r.status === 402 || r.status === 403 ? "Research credits are exhausted." : `Research request failed (${r.status}).`); }
  const j = JSON.parse(body) as { output_text?: string; output?: { content?: { type?: string; text?: string }[] }[] };
  const text = j.output_text ?? j.output?.flatMap((o) => o.content ?? []).find((c) => c.text)?.text ?? "";
  return JSON.parse(text);
}

const Period = z.object({ start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

export const fetchEtfFlows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Period.refine((p) => Date.parse(p.end) >= Date.parse(p.start) && Date.parse(p.end) - Date.parse(p.start) <= 4 * 864e5, "Request up to five calendar days at a time.").parse(d))
  .handler(async ({ data }) => {
    const fields = Object.fromEntries(ETF_ISSUERS.map((i) => [i.key, num]));
    const row = { type: "object", additionalProperties: false, required: ["date", ...ETF_ISSUERS.map((i) => i.key), "total"], properties: { date: str, ...fields, total: num } };
    const schema = { type: "object", additionalProperties: false, required: ["rows", "sources"], properties: { rows: { type: "array", items: row }, sources: { type: "array", items: str } } };
    const out = await parallel(
      `Daily net flows of US spot bitcoin ETFs in US$ millions for every US trading day from ${data.start} to ${data.end}, at most 5 rows. Columns: ${ETF_ISSUERS.map((i) => `${i.ticker} (${i.name})`).join(", ")}, and total net flow across ALL US spot bitcoin ETFs (not just these ten funds). These are ten selected issuers, not a verified current ranking. Prefer Farside Investors' bitcoin ETF flow table or issuer data. Check current fund names and ownership; do not treat an issuer rename as a new fund. Dates as YYYY-MM-DD. Return null rather than guess any value. For missing trading days still include a row of nulls. Do not include weekends or exchange holidays. List the source URLs used.`, schema);
    return out as { rows: FlowRow[]; sources: string[] };
  });

export const fetchEtfNews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Period.parse(d))
  .handler(async ({ data }) => {
    const item = { type: "object", additionalProperties: false, required: ["date", "headline", "source", "url", "category", "sentiment"], properties: { date: str, headline: str, source: str, url: str, category: str, sentiment: num } };
    const schema = { type: "object", additionalProperties: false, required: ["items"], properties: { items: { type: "array", items: item } } };
    const out = await parallel(
      `Up to five most market-relevant real bitcoin and bitcoin-ETF headlines published between ${data.start} and ${data.end}: ETF issuers, SEC/regulation, macro (Fed, CPI), institutional flows, exchange events. For each: publication date YYYY-MM-DD, headline, outlet, article URL, category (etf, regulation, macro, institutional, exchange, other), and estimated sentiment for bitcoin from -1 to 1, or null if unclear. Sentiment is a model score, not observed price impact. Only real articles with working URLs; never invent.`, schema);
    return out as { items: { date: string; headline: string; source: string; url: string; category: string; sentiment: number | null }[] };
  });

const SaveInput = z.object({
  period: Period, flows: z.array(z.any()).max(60), news: z.array(z.any()).max(80),
  stats: z.record(z.string(), z.any()), sources: z.array(z.string()).max(40), daily: z.string().max(12000),
});

export const explainAndSave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveInput.parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured.");
    const r = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra", stream: true, store: false, reasoning: { effort: "medium" },
        instructions: `You are a cautious market-microstructure research assistant in FZ HMI. Using ONLY the data given, explain in plain markdown (max ~500 words): 1) net ETF flows and which named issuers contributed on observed days, 2) whether flows, estimated news sentiment and same/next-day BTC returns aligned or diverged, citing actual dates and correlation sample sizes, 3) plausible explanations for divergences (basis-trade unwinds, rebalancing, macro, reporting lags, news priced in earlier) labelled unverified hypotheses, 4) missing-data and small-sample limitations. An issuer's ETF net flow is not evidence that the institution bought bitcoin for its own account. Sentiment is an AI-estimated score, not measured impact. BTC returns are UTC daily; ETF flows are reported after US close, so timing does not establish causation. Never invent numbers, events or citations, no trading advice or predictions. Use only supplied article links.`,
        input: [{ role: "user", content: `Period ${data.period.start}..${data.period.end}\nSTATS:${JSON.stringify(data.stats)}\nISSUER FLOWS:${JSON.stringify(data.flows)}\nDAILY (date, total flow $M, mean news sentiment, BTC return %):\n${data.daily}\nHEADLINES:\n${data.news.slice(0, 60).map((n: { date: string; headline: string; sentiment: number | null; url: string }) => `${n.date} [${n.sentiment}] ${n.headline} ${n.url}`).join("\n")}` }],
      }),
    });
    if (r.status === 429) throw new Error("Too many AI requests — wait a moment.");
    if (r.status === 402) throw new Error("AI credits are exhausted for this workspace.");
    if (!r.ok || !r.body) throw new Error(`AI request failed (${r.status}).`);
    const reader = r.body.getReader(), dec = new TextDecoder();
    let buf = "", explanation = "";
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() ?? "";
      for (const l of lines) {
        if (!l.startsWith("data:")) continue;
        const d = l.slice(5).trim(); if (!d || d === "[DONE]") continue;
        try { const e = JSON.parse(d) as { type?: string; delta?: string }; if (e.type === "response.output_text.delta" && e.delta) explanation += e.delta; } catch { /* partial */ }
      }
    }
    if (!explanation.trim()) throw new Error("AI returned no explanation. The analysis has not been saved.");
    const { data: row, error } = await context.supabase.from("etf_news_analyses").insert({
      user_id: context.userId, period_start: data.period.start, period_end: data.period.end,
      flows: data.flows, news: data.news, stats: data.stats, explanation, sources: data.sources,
    }).select("id, created_at").single();
    if (error) throw new Error(error.message);
    return { id: row.id, created_at: row.created_at, explanation };
  });

import { useEffect, useState } from "react";
import { useFeed, type Column } from "@/lib/market/binance-feed";
import { listSessions, loadSessionColumns, type RecordingSession } from "@/lib/market/recorder";
import { DEFAULT_PARAMS, type Params } from "@/lib/market/analysis";
import { useUser } from "@/lib/auth";

/** Lets a page analyse either the live rolling buffer or a permanently recorded session. */
export function useDataSource() {
  const feed = useFeed();
  const user = useUser();
  const [sessions, setSessions] = useState<RecordingSession[]>([]);
  const [sel, setSel] = useState<string>("live");
  const [saved, setSaved] = useState<Column[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setSessions([]); setSaved(null); setSel("live"); setError(null);
    if (user) listSessions().then((rows) => { if (active) setSessions(rows); }).catch((e) => { if (active) setError((e as Error).message); });
    return () => { active = false; };
  }, [user?.id]);
  useEffect(() => {
    if (sel === "live" || !user) { setSaved(null); return; }
    setLoading(true); setError(null);
    loadSessionColumns(sel).then(setSaved).catch((e) => setError((e as Error).message)).finally(() => setLoading(false));
  }, [sel]);
  const columns = sel === "live" ? feed.columns : saved ?? [];
  return { sessions, sel, setSel, columns, loading, error, isLive: sel === "live", tick: feed.tick };
}

export function SourcePicker({ ds }: { ds: ReturnType<typeof useDataSource> }) {
  return (
    <label className="flex flex-wrap items-center gap-2 text-xs">
      <span className="label-caps">Data</span>
      <select value={ds.sel} onChange={(e) => ds.setSel(e.target.value)} className="rounded-sm border bg-background px-2 py-1 font-mono">
        <option value="live">Live buffer (last ≤10 min, this tab)</option>
        {ds.sessions.map((s) => <option key={s.id} value={s.id}>{new Date(s.started_at).toISOString().slice(0, 16).replace("T", " ")} UTC · {s.column_count} cols{s.note ? ` · ${s.note}` : ""}</option>)}
      </select>
      {ds.loading && <span className="text-muted-foreground">loading…</span>}
      {ds.error && <span className="text-destructive">{ds.error}</span>}
    </label>
  );
}

const FIELDS: { k: keyof Params; l: string; step: number; scale?: number }[] = [
  { k: "minQty", l: "Min size change (BTC)", step: 0.5 },
  { k: "minPct", l: "Min relative change (%)", step: 5, scale: 100 },
  { k: "maxDistance", l: "Max distance from mid ($)", step: 50 },
  { k: "touchTolerance", l: "Touch tolerance ($)", step: 5 },
  { k: "relocateWindow", l: "Reappearance window (s)", step: 1 },
  { k: "relocateSizeTol", l: "Reappearance size tolerance (%)", step: 5, scale: 100 },
  { k: "shortLivedMax", l: "Short-lived max lifetime (s)", step: 1 },
];
export function ParamsEditor({ p, onChange }: { p: Params; onChange: (p: Params) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-4">
      {FIELDS.map((f) => (
        <label key={f.k} className="text-xs">
          <span className="text-muted-foreground">{f.l}</span>
          <input type="number" step={f.step} min={0} value={+(p[f.k] * (f.scale ?? 1)).toFixed(2)}
            onChange={(e) => onChange({ ...p, [f.k]: Number(e.target.value) / (f.scale ?? 1) })}
            className="mt-1 w-full rounded-sm border bg-background px-2 py-1 font-mono" />
        </label>
      ))}
      <button onClick={() => onChange(DEFAULT_PARAMS)} className="self-end rounded-sm border px-2 py-1 text-xs hover:bg-accent">Reset defaults</button>
    </div>
  );
}

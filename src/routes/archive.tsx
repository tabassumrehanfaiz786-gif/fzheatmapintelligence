import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { useUser } from "@/lib/auth";
import { Heatmap } from "@/components/Heatmap";
import { exportColumnsCSV, type Column } from "@/lib/market/binance-feed";
import { deleteSession, listSessions, loadSessionColumns, type RecordingSession } from "@/lib/market/recorder";

export const Route = createFileRoute("/archive")({
  head: () => ({ meta: [
    { title: "Session Archive · Fz Heat Map Intelligence" },
    { name: "description", content: "Permanently recorded BTC/USDT order-book sessions with historical heatmap replay." },
    { property: "og:title", content: "Session Archive · FZ HMI" },
    { property: "og:description", content: "Replay recorded order-book liquidity sessions stored permanently in Lovable Cloud." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ArchivePage,
});

const RANGES = [250, 500, 1000, 1500];
const WINDOWS = [{ s: 60, l: "1m" }, { s: 300, l: "5m" }, { s: 600, l: "10m" }, { s: 86400, l: "All" }];

function ArchivePage() {
  const user = useUser();
  const [sessions, setSessions] = useState<RecordingSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<RecordingSession | null>(null);
  const [columns, setColumns] = useState<Column[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState(500);
  const [secs, setSecs] = useState(600);

  const refresh = () => listSessions().then(setSessions).catch((e) => setError((e as Error).message));
  useEffect(() => { if (user) refresh(); }, [user]);

  if (user === null) return (
    <>
      <PageHeader title="Session Archive" sub="Permanently recorded order-book sessions, stored in Lovable Cloud." />
      <div className="panel p-6 text-sm text-muted-foreground">
        Your recordings are private to your account. <Link to="/auth" className="text-primary underline">Sign in</Link> to view and replay them.
      </div>
    </>
  );

  async function open(s: RecordingSession) {
    setActive(s); setColumns(null); setLoading(true); setError(null);
    try { setColumns(await loadSessionColumns(s.id)); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function remove(s: RecordingSession) {
    if (!window.confirm(`Delete the session from ${new Date(s.started_at).toLocaleString()}? This cannot be undone.`)) return;
    try {
      await deleteSession(s.id);
      if (active?.id === s.id) { setActive(null); setColumns(null); }
      refresh();
    } catch (e) { setError((e as Error).message); }
  }

  const btn = (on: boolean) => `rounded-sm border px-2 py-1 font-mono text-xs ${on ? "border-primary text-primary" : "text-muted-foreground"}`;

  return (
    <>
      <PageHeader
        title="Session Archive"
        sub="Permanently recorded order-book sessions, stored in Lovable Cloud. Select a session to replay its liquidity heatmap."
      />
      {error && <div className="mb-3 rounded-sm border border-destructive px-3 py-2 text-xs text-destructive">{error}</div>}
      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <div className="panel max-h-[70vh] overflow-y-auto p-2">
          <div className="label-caps px-1 pb-2">Recorded sessions</div>
          {sessions === null && <p className="px-1 text-xs text-muted-foreground">Loading…</p>}
          {sessions?.length === 0 && (
            <p className="px-1 text-xs text-muted-foreground">
              No recordings yet. Open the Live Heatmap and press “Record session”.
            </p>
          )}
          {sessions?.map((s) => (
            <div key={s.id} className={`mb-1 rounded-sm border px-2 py-2 text-xs ${active?.id === s.id ? "border-primary" : ""}`}>
              <button className="block w-full text-left" onClick={() => open(s)}>
                <div className="font-mono">{new Date(s.started_at).toLocaleString()}</div>
                <div className="mt-0.5 text-muted-foreground">
                  {s.column_count} samples · {s.symbol} · ${s.bucket} buckets
                  {s.ended_at ? "" : " · still open"}
                </div>
                {s.note && <div className="mt-0.5 text-muted-foreground">“{s.note}”</div>}
              </button>
              <button className="mt-1 text-destructive hover:underline" onClick={() => remove(s)}>Delete</button>
            </div>
          ))}
        </div>
        <div>
          {!active && <div className="panel p-5 text-sm text-muted-foreground">Select a session on the left to replay it.</div>}
          {active && (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="label-caps">Zoom ±$</span>
                {RANGES.map((r) => <button key={r} className={btn(range === r)} onClick={() => setRange(r)}>{r}</button>)}
                <span className="label-caps ml-2">Window</span>
                {WINDOWS.map((w) => <button key={w.s} className={btn(secs === w.s)} onClick={() => setSecs(w.s)}>{w.l}</button>)}
                <button
                  className="ml-auto rounded-sm bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-40"
                  disabled={!columns?.length}
                  onClick={() => columns && exportColumnsCSV(columns, range)}
                >
                  Export session CSV
                </button>
              </div>
              {loading && <div className="panel p-5 text-sm text-muted-foreground">Loading recorded data…</div>}
              {columns && (
                <>
                  <Heatmap columns={columns} range={range} seconds={secs} tick={columns.length} />
                  <p className="mt-3 text-xs text-muted-foreground">
                    Replay of {columns.length} one-second samples recorded from {active.source} ({active.symbol}),
                    {" "}{new Date(active.started_at).toLocaleString()} → {active.ended_at ? new Date(active.ended_at).toLocaleString() : "open"}.
                    Data is shown exactly as recorded; no gaps are filled.
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

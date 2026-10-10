import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BUCKET, SOURCE, useFeed, type Column } from "./binance-feed";

export interface RecordingSession {
  id: string;
  started_at: string;
  ended_at: string | null;
  symbol: string;
  source: string;
  bucket: number;
  note: string | null;
  column_count: number;
}

function toRow(sessionId: string, c: Column) {
  return {
    session_id: sessionId,
    t: new Date(c.t).toISOString(),
    mid: c.mid,
    best_bid: c.bestBid,
    best_ask: c.bestAsk,
    levels: Object.fromEntries([...c.levels].map(([p, v]) => [String(p), v])),
  };
}

/** Records live heatmap columns into Lovable Cloud while active. */
export function useRecorder() {
  const f = useFeed();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const pending = useRef<Column[]>([]);
  const seen = useRef(0);
  const count = useRef(0);

  // Queue new columns as they arrive.
  useEffect(() => {
    if (!sessionId) return;
    const cols = f.columns;
    if (cols.length >= seen.current) {
      pending.current.push(...cols.slice(seen.current));
      seen.current = cols.length;
    } else {
      seen.current = cols.length; // buffer rotated; resync to tail
    }
  }, [sessionId, f.tick, f.columns]);

  async function flush(id: string) {
    const batch = pending.current.splice(0, pending.current.length);
    if (!batch.length) return;
    const { error: err } = await supabase.from("recording_columns").insert(batch.map((c) => toRow(id, c)));
    if (err) {
      setError(err.message);
      pending.current.unshift(...batch); // retry next flush
      return;
    }
    count.current += batch.length;
    setSavedCount(count.current);
    await supabase.from("recording_sessions").update({ column_count: count.current }).eq("id", id);
  }

  // Flush every 5 seconds while recording.
  useEffect(() => {
    if (!sessionId) return;
    const iv = setInterval(() => flush(sessionId), 5000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function start(note?: string) {
    setError(null);
    const { data, error: err } = await supabase
      .from("recording_sessions")
      .insert({ symbol: SOURCE.symbol, source: SOURCE.exchange, bucket: BUCKET, note: note ?? null })
      .select("id")
      .single();
    if (err) { setError(err.message); return; }
    seen.current = f.columns.length;
    count.current = 0;
    setSavedCount(0);
    pending.current = [];
    setSessionId(data.id);
  }

  async function stop() {
    if (!sessionId) return;
    const id = sessionId;
    setSessionId(null);
    await flush(id);
    await supabase.from("recording_sessions")
      .update({ ended_at: new Date().toISOString(), column_count: count.current })
      .eq("id", id);
  }

  return { recording: sessionId !== null, start, stop, error, savedCount };
}

export async function listSessions(): Promise<RecordingSession[]> {
  const { data, error } = await supabase
    .from("recording_sessions")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function deleteSession(id: string) {
  const { error } = await supabase.from("recording_sessions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function loadSessionColumns(id: string): Promise<Column[]> {
  const out: Column[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("recording_columns")
      .select("t,mid,best_bid,best_ask,levels")
      .eq("session_id", id)
      .order("t", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const r of data) {
      const levels = new Map<number, { bid: number; ask: number }>();
      for (const [p, v] of Object.entries(r.levels as Record<string, { bid: number; ask: number }>))
        levels.set(Number(p), v);
      out.push({ t: new Date(r.t).getTime(), mid: r.mid, bestBid: r.best_bid, bestAsk: r.best_ask, levels });
    }
    if (data.length < 1000) break;
    from += 1000;
  }
  return out;
}

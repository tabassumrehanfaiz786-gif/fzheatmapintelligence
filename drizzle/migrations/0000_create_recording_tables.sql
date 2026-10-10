CREATE TABLE public.recording_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  symbol TEXT NOT NULL,
  source TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  note TEXT,
  column_count INTEGER NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recording_sessions TO anon, authenticated;
GRANT ALL ON public.recording_sessions TO service_role;
ALTER TABLE public.recording_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read sessions" ON public.recording_sessions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public insert sessions" ON public.recording_sessions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public update sessions" ON public.recording_sessions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public delete sessions" ON public.recording_sessions FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE public.recording_columns (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.recording_sessions(id) ON DELETE CASCADE,
  t TIMESTAMPTZ NOT NULL,
  mid DOUBLE PRECISION NOT NULL,
  best_bid DOUBLE PRECISION NOT NULL,
  best_ask DOUBLE PRECISION NOT NULL,
  levels JSONB NOT NULL
);
CREATE INDEX recording_columns_session_idx ON public.recording_columns(session_id, t);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recording_columns TO anon, authenticated;
GRANT ALL ON public.recording_columns TO service_role;
ALTER TABLE public.recording_columns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read columns" ON public.recording_columns FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public insert columns" ON public.recording_columns FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public update columns" ON public.recording_columns FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public delete columns" ON public.recording_columns FOR DELETE TO anon, authenticated USING (true);
ALTER TABLE public.recording_sessions ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE public.research_projects ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();

DROP POLICY IF EXISTS "public delete sessions" ON public.recording_sessions;
DROP POLICY IF EXISTS "public insert sessions" ON public.recording_sessions;
DROP POLICY IF EXISTS "public read sessions" ON public.recording_sessions;
DROP POLICY IF EXISTS "public update sessions" ON public.recording_sessions;
DROP POLICY IF EXISTS "public delete columns" ON public.recording_columns;
DROP POLICY IF EXISTS "public insert columns" ON public.recording_columns;
DROP POLICY IF EXISTS "public read columns" ON public.recording_columns;
DROP POLICY IF EXISTS "public update columns" ON public.recording_columns;
DROP POLICY IF EXISTS "public delete projects" ON public.research_projects;
DROP POLICY IF EXISTS "public insert projects" ON public.research_projects;
DROP POLICY IF EXISTS "public read projects" ON public.research_projects;
DROP POLICY IF EXISTS "public update projects" ON public.research_projects;

REVOKE ALL ON public.recording_sessions, public.recording_columns, public.research_projects FROM anon;

CREATE POLICY "own sessions" ON public.recording_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own projects" ON public.research_projects FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own columns" ON public.recording_columns FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recording_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.recording_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()));

CREATE TABLE public.etf_news_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  flows jsonb NOT NULL DEFAULT '[]'::jsonb,
  news jsonb NOT NULL DEFAULT '[]'::jsonb,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  explanation text NOT NULL DEFAULT '',
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text NOT NULL DEFAULT ''
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.etf_news_analyses TO authenticated;
GRANT ALL ON public.etf_news_analyses TO service_role;
ALTER TABLE public.etf_news_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own analyses" ON public.etf_news_analyses FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
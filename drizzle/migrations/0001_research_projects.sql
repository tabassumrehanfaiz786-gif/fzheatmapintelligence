CREATE TABLE public.research_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  question text NOT NULL DEFAULT '',
  hypothesis text NOT NULL DEFAULT '',
  session_id uuid REFERENCES public.recording_sessions(id) ON DELETE SET NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  results jsonb,
  software_version text,
  notes text NOT NULL DEFAULT '',
  report jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_projects TO anon, authenticated;
GRANT ALL ON public.research_projects TO service_role;
ALTER TABLE public.research_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read projects" ON public.research_projects FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public insert projects" ON public.research_projects FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public update projects" ON public.research_projects FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public delete projects" ON public.research_projects FOR DELETE TO anon, authenticated USING (true);
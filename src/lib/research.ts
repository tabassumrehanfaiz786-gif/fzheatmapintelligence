import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Project = Database["public"]["Tables"]["research_projects"]["Row"];
export type ProjectPatch = Database["public"]["Tables"]["research_projects"]["Update"];

export async function listProjects(): Promise<Project[]> {
  const { data, error } = await supabase.from("research_projects").select("*").order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}
export async function createProject(title: string): Promise<Project> {
  const { data, error } = await supabase.from("research_projects").insert({ title }).select().single();
  if (error) throw new Error(error.message);
  return data;
}
export async function updateProject(id: string, patch: ProjectPatch) {
  const { error } = await supabase.from("research_projects").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}
export async function deleteProject(id: string) {
  const { error } = await supabase.from("research_projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

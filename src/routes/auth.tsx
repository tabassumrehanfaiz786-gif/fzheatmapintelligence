import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Sign in · Fz Heat Map Intelligence" },
    { name: "description", content: "Sign in to keep your recordings, research projects and ETF/news analyses private." },
    { property: "og:title", content: "Sign in · FZ HMI" },
    { property: "og:description", content: "Private research workspace for order-book and ETF-flow studies." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState(""), [pw, setPw] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    const r = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password: pw })
      : await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: window.location.origin } });
    if (r.error) return setMsg(r.error.message);
    if (mode === "up" && !r.data.session) return setMsg("Check your email to confirm your account.");
    nav({ to: "/" });
  }

  return (
    <>
      <PageHeader title="Sign in" sub="Your recordings, research projects and saved analyses are private to your account." />
      <div className="panel max-w-sm space-y-3 p-4">
        <button className="w-full rounded-sm border px-3 py-2 text-sm hover:bg-accent"
          onClick={async () => { const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin }); if (r?.error) setMsg(String(r.error.message ?? r.error)); }}>
          Continue with Google
        </button>
        <form onSubmit={submit} className="space-y-2">
          <input className="w-full rounded-sm border bg-background px-2 py-1.5 text-sm" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="w-full rounded-sm border bg-background px-2 py-1.5 text-sm" type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={6} />
          <button className="w-full rounded-sm bg-primary px-3 py-2 text-sm text-primary-foreground">{mode === "in" ? "Sign in" : "Create account"}</button>
        </form>
        <button className="text-xs text-muted-foreground underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? "No account? Create one" : "Have an account? Sign in"}</button>
        {msg && <p className="text-xs text-warn">{msg}</p>}
      </div>
    </>
  );
}

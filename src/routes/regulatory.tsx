import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, StatusBadge } from "@/components/AppShell";
import { download } from "@/lib/market/analysis";
import { listProjects, updateProject, type Project } from "@/lib/research";

export const Route = createFileRoute("/regulatory")({
  head: () => ({ meta: [
    { title: "Regulatory Research · Fz Heat Map Intelligence" },
    { name: "description", content: "Structured eight-part regulatory research reports linking order-book observations to legal frameworks, with evidentiary limits." },
    { property: "og:title", content: "Regulatory Research · FZ HMI" },
    { property: "og:description", content: "Build structured regulatory research reports from saved studies." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: RegPage,
});

const SECTIONS = ["Research question", "Relevant observations", "Data and methodology", "Alternative explanations", "Evidentiary limitations", "Applicable legal framework", "Potential regulatory implications", "Further evidence required"];

const FRAMEWORKS = [
  { name: "EU — Markets in Crypto-Assets Regulation (MiCA), Regulation (EU) 2023/1114, Title VI (market abuse; Art. 91 market manipulation)", tag: "Current law" },
  { name: "US — Commodity Exchange Act §4c(a)(5)(C), anti-spoofing provision added by the Dodd-Frank Act", tag: "Current law" },
  { name: "UK — Market Abuse Regulation (UK MAR), and the FCA's planned crypto-asset market abuse regime", tag: "Current law / proposed reform" },
  { name: "IOSCO — Policy Recommendations for Crypto and Digital Asset Markets (2023)", tag: "Guidance" },
];

function RegPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [id, setId] = useState("");
  const [r, setR] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { listProjects().then(setProjects).catch((e) => setMsg(e.message)); }, []);
  const p = projects.find((x) => x.id === id);
  useEffect(() => { if (!p) return; const rep = p.report as Record<string, string>;
    setR({ ...rep, [SECTIONS[0]!]: rep[SECTIONS[0]!] || p.question, [SECTIONS[3]!]: rep[SECTIONS[3]!] || "", [SECTIONS[4]!]: rep[SECTIONS[4]!] || p.notes }); }, [id]);
  const md = () => `# ${p?.title}\n\n_Fz Heat Map Intelligence — research report, generated ${new Date().toISOString()}_\n\n` + SECTIONS.map((s, i) => `## ${i + 1}. ${s}\n\n${r[s] || "_(not completed)_"}\n`).join("\n") + `\n---\nObservations are potential indicators, not findings of misconduct. Legal references must be checked against official texts.\n`;

  return (
    <>
      <PageHeader title="Regulatory Research" sub="Turn a Research Studio project into a structured eight-part report linking what was observed to the relevant legal frameworks, with the limits of the evidence stated." badge={<StatusBadge s="Implemented" />} />
      <div className="panel mb-4 flex flex-wrap items-center gap-2 p-3 text-xs">
        <span className="label-caps">Project</span>
        <select value={id} onChange={(e) => setId(e.target.value)} className="rounded-sm border bg-background px-2 py-1">
          <option value="">— choose a Research Studio project —</option>
          {projects.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
        </select>
        {msg && <span className="text-muted-foreground">{msg}</span>}
      </div>
      {!p ? <div className="panel p-6 text-sm text-muted-foreground">{projects.length ? "Choose a project to write its report." : "Create a project in Research Studio first."}</div> : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="panel space-y-3 p-4">
            {SECTIONS.map((s, i) => (
              <label key={s} className="block text-xs text-muted-foreground">{i + 1}. {s}
                <textarea rows={3} value={r[s] ?? ""} onChange={(e) => setR({ ...r, [s]: e.target.value })} className="mt-1 w-full rounded-sm border bg-background px-2 py-1.5 text-sm text-foreground" />
              </label>))}
            <div className="flex gap-2">
              <button onClick={async () => { await updateProject(p.id, { report: r }); setMsg("Saved"); setTimeout(() => setMsg(null), 1500); }} className="rounded-sm border border-primary px-3 py-1.5 text-sm text-primary">Save report</button>
              <button onClick={() => download(`fzhmi_report_${p.id}.md`, md(), "text/markdown")} className="rounded-sm border px-3 py-1.5 text-sm hover:bg-accent">Export Markdown</button>
            </div>
          </div>
          <div className="panel h-fit p-3 text-xs">
            <div className="label-caps mb-2">Reference frameworks</div>
            <ul className="space-y-2">{FRAMEWORKS.map((f) => <li key={f.name} className="rounded-sm border p-2">{f.name}<div className="mt-1 font-mono text-[0.65rem] uppercase text-warn">{f.tag} · verify against official text</div></li>)}</ul>
            <p className="mt-3 text-muted-foreground">This is a starting list, not legal advice. Check each source and its current status before citing it.</p>
          </div>
        </div>)}
    </>
  );
}

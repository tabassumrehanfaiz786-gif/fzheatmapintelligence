import { createFileRoute } from "@tanstack/react-router";
import { PlannedModule } from "@/components/AppShell";

export const Route = createFileRoute("/regulatory")({
  head: () => ({ meta: [
    { title: "Market Transparency & Regulatory Research · Fz Heat Map Intelligence" },
    { name: "description", content: "Structured legal research on transparency, technological asymmetry and surveillance." },
    { property: "og:title", content: "Market Transparency & Regulatory Research · FZ HMI" },
    { property: "og:description", content: "Structured legal research on transparency, technological asymmetry and surveillance." },
  ] }),
  component: () => <PlannedModule title="Market Transparency & Regulatory Research" sub="Structured legal research on transparency, technological asymmetry and surveillance." stage={6} items={["1. Research question","2. Relevant observations","3. Data and methodology","4. Alternative explanations","5. Evidentiary limitations","6. Applicable legal framework","7. Potential regulatory implications","8. Further evidence required"]} note="Sources will be tagged as current law, guidance, academic literature or proposed reform, and only after verification." />,
});

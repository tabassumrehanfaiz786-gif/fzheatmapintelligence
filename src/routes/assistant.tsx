import { createFileRoute } from "@tanstack/react-router";
import { PlannedModule } from "@/components/AppShell";

export const Route = createFileRoute("/assistant")({
  head: () => ({ meta: [
    { title: "AI Research Assistant · Fz Heat Map Intelligence" },
    { name: "description", content: "AI help grounded in recorded observations, with stated uncertainty." },
    { property: "og:title", content: "AI Research Assistant · FZ HMI" },
    { property: "og:description", content: "AI help grounded in recorded observations, with stated uncertainty." },
  ] }),
  component: () => <PlannedModule title="AI Research Assistant" sub="AI help grounded in recorded observations, with stated uncertainty." stage={6} items={["Summarise a selected event","Explain metrics and methods","Compare recorded events","Identify missing data & alternatives","Draft research notes","Suggest testable hypotheses"]} note="Will run server-side only; no keys in the browser. Needs recorded data first." />,
});

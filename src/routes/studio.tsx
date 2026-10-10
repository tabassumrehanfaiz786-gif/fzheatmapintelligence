import { createFileRoute } from "@tanstack/react-router";
import { PlannedModule } from "@/components/AppShell";

export const Route = createFileRoute("/studio")({
  head: () => ({ meta: [
    { title: "Research Studio · Fz Heat Map Intelligence" },
    { name: "description", content: "Workspace for research questions, saved sessions and reproducible analyses." },
    { property: "og:title", content: "Research Studio · FZ HMI" },
    { property: "og:description", content: "Workspace for research questions, saved sessions and reproducible analyses." },
  ] }),
  component: () => <PlannedModule title="Research Studio" sub="Workspace for research questions, saved sessions and reproducible analyses." stage={5} items={["Research questions & observation periods","Saved parameters & re-runs","Event comparison","Descriptive statistics with sample sizes","Missing-data and sensitivity reporting","Methodology & software version log"]} note="Permanent storage (Lovable Cloud) is now enabled and already powers the Session Archive. The full Studio workspace is planned for a later stage." />,
});

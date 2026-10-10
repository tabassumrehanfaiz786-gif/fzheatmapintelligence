import { createFileRoute } from "@tanstack/react-router";
import { PlannedModule } from "@/components/AppShell";

export const Route = createFileRoute("/integrity")({
  head: () => ({ meta: [
    { title: "Market Integrity · Fz Heat Map Intelligence" },
    { name: "description", content: "Monitoring of unusual order-book patterns with transparent thresholds." },
    { property: "og:title", content: "Market Integrity · FZ HMI" },
    { property: "og:description", content: "Monitoring of unusual order-book patterns with transparent thresholds." },
  ] }),
  component: () => <PlannedModule title="Market Integrity" sub="Monitoring of unusual order-book patterns with transparent thresholds." stage={5} items={["Rapid add/cancel patterns","Short-lived large orders","Repeated appear/disappear cycles","Depth vs executed trades","Supporting data per alert","Thresholds & limitations shown"]} note="Alerts will read as \"potential spoofing indicator\" — never as proven fraud." />,
});

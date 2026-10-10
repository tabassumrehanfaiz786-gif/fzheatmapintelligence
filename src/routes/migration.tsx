import { createFileRoute } from "@tanstack/react-router";
import { PlannedModule } from "@/components/AppShell";

export const Route = createFileRoute("/migration")({
  head: () => ({ meta: [
    { title: "Liquidity Migration · Fz Heat Map Intelligence" },
    { name: "description", content: "Principal research engine: how displayed liquidity changes across price levels and time." },
    { property: "og:title", content: "Liquidity Migration · FZ HMI" },
    { property: "og:description", content: "Principal research engine: how displayed liquidity changes across price levels and time." },
  ] }),
  component: () => <PlannedModule title="Liquidity Migration" sub="Principal research engine: how displayed liquidity changes across price levels and time." stage={4} items={["Configurable sweep / acceptance / rejection rules","Additions, cancellations and persistence","Reappearance at other levels","Event records with ID, source, parameters","Annotations, alternative explanations, limitations","CSV / JSON reproducible exports"]} note="Liquidity vanishing at one level and appearing at another will not be treated as the same order or participant. Liquidity Destination Theory is treated as a hypothesis to test." />,
});

import { createFileRoute } from "@tanstack/react-router";
import { PlannedModule } from "@/components/AppShell";

export const Route = createFileRoute("/spot-perp")({
  head: () => ({ meta: [
    { title: "Spot vs Perpetual · Fz Heat Map Intelligence" },
    { name: "description", content: "Synchronised spot and perpetual futures order-book comparison." },
    { property: "og:title", content: "Spot vs Perpetual · FZ HMI" },
    { property: "og:description", content: "Synchronised spot and perpetual futures order-book comparison." },
  ] }),
  component: () => <PlannedModule title="Spot vs Perpetual" sub="Synchronised spot and perpetual futures order-book comparison." stage={4} items={["Spot vs perpetual depth","Bid/ask imbalance","Executed trades & CVD","Funding rates","Open interest","Liquidations with source attribution","Time-aligned events"]} note="Divergence between markets will be shown as observed correlation only, never labelled manipulation." />,
});

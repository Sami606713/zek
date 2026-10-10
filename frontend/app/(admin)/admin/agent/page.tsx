import type { Metadata } from "next";
import { AgentInsights } from "@/components/admin/agent/AgentInsights";

export const metadata: Metadata = { title: "Agent insights" };

export default function AgentPage() {
  return <AgentInsights />;
}

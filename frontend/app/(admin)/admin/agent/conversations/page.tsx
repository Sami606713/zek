import type { Metadata } from "next";
import { Suspense } from "react";
import { ConversationsTable } from "@/components/admin/agent/ConversationsTable";

export const metadata: Metadata = { title: "Conversations" };

export default function ConversationsPage() {
  return (
    <Suspense>
      <ConversationsTable />
    </Suspense>
  );
}

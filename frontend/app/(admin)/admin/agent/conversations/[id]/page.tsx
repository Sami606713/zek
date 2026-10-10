import type { Metadata } from "next";
import Link from "next/link";
import { conversations, getConversation } from "@/lib/admin/mock";
import { Transcript } from "@/components/admin/agent/Transcript";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Conversation" };

export function generateStaticParams() {
  return conversations.map((c) => ({ id: c.id }));
}

export default async function ConversationPage({ params }: PageProps<"/admin/agent/conversations/[id]">) {
  const { id } = await params;
  const conversation = getConversation(id);
  if (!conversation) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-start gap-3 rounded-xl border border-line bg-surface p-8">
        <h1 className="text-xl font-semibold text-ink">Conversation not found</h1>
        <Button asChild variant="outline">
          <Link href="/admin/agent/conversations">Back to conversations</Link>
        </Button>
      </div>
    );
  }
  return <Transcript conversation={conversation} />;
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Flag } from "@phosphor-icons/react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, SortHeader } from "@/components/admin/DataTable";
import { PageHeader } from "@/components/admin/PageHeader";
import { ChannelLabel, OutcomeBadge } from "@/components/admin/badges";
import { conversations, getCustomer, type Conversation } from "@/lib/admin/mock";
import { formatRelative } from "@/lib/admin/format";

type Tab = "all" | "flagged" | "unresolved" | "purchase";

const columns: ColumnDef<Conversation, unknown>[] = [
  {
    id: "customer",
    header: "Customer",
    accessorFn: (c) => (c.customerId ? getCustomer(c.customerId)?.name : "Guest"),
    cell: ({ row, getValue }) => (
      <div className="flex items-center gap-2">
        {row.original.flagged && <Flag size={14} weight="fill" className="text-danger" aria-label="Flagged" />}
        <span className="font-medium text-ink">{getValue() as string}</span>
      </div>
    ),
  },
  { accessorKey: "channel", header: "Channel", cell: ({ row }) => <ChannelLabel channel={row.original.channel} /> },
  {
    accessorKey: "summary",
    header: "Topic",
    cell: ({ row }) => <span className="block max-w-[340px] truncate text-subtle">{row.original.summary}</span>,
  },
  {
    id: "messages",
    header: "Messages",
    accessorFn: (c) => c.messages.length,
    cell: ({ getValue }) => <span className="tabular-nums">{getValue() as number}</span>,
  },
  { accessorKey: "outcome", header: "Outcome", cell: ({ row }) => <OutcomeBadge outcome={row.original.outcome} /> },
  {
    accessorKey: "startedAt",
    header: ({ column }) => <SortHeader label="Started" column={column} />,
    cell: ({ row }) => <span className="whitespace-nowrap text-subtle">{formatRelative(row.original.startedAt)}</span>,
  },
];

export function ConversationsTable() {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get("flagged") ? "flagged" : "all");
  const [channel, setChannel] = useState("all");

  const visible = conversations.filter(
    (c) =>
      (tab === "all" || (tab === "flagged" ? c.flagged : c.outcome === tab)) &&
      (channel === "all" || c.channel === channel),
  );

  return (
    <>
      <PageHeader title="Conversations" description="Every chat the agent has had, with the tools it used." />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="flagged">Flagged ({conversations.filter((c) => c.flagged).length})</TabsTrigger>
          <TabsTrigger value="unresolved">Unresolved</TabsTrigger>
          <TabsTrigger value="purchase">Purchases</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable
        columns={columns}
        data={visible}
        getRowId={(c) => c.id}
        searchPlaceholder="Search customer or topic"
        globalFilterFn={(c, q) =>
          c.summary.toLowerCase().includes(q) ||
          Boolean(c.customerId && getCustomer(c.customerId)?.name.toLowerCase().includes(q)) ||
          c.messages.some((m) => m.text.toLowerCase().includes(q))
        }
        toolbar={
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger className="h-9 w-40 bg-surface" aria-label="Channel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All channels</SelectItem>
              <SelectItem value="agent">Web chat</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="voice">Voice</SelectItem>
            </SelectContent>
          </Select>
        }
        onRowClick={(c) => router.push(`/admin/agent/conversations/${c.id}`)}
        emptyText="No conversations match."
      />
    </>
  );
}

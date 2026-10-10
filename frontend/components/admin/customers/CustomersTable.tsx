"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, SortHeader } from "@/components/admin/DataTable";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { customers, customerStats, type AdminCustomer } from "@/lib/admin/mock";
import { formatDate, formatMoney, formatRelative, initials } from "@/lib/admin/format";

type Row = AdminCustomer & ReturnType<typeof customerStats>;

const columns: ColumnDef<Row, unknown>[] = [
  {
    id: "customer",
    accessorFn: (c) => c.name,
    header: ({ column }) => <SortHeader label="Customer" column={column} />,
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <Avatar className="size-8">
          <AvatarFallback className="bg-brand-soft text-[11px] font-semibold text-brand">{initials(row.original.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{row.original.name}</p>
          <p className="truncate text-[12px] text-subtle">{row.original.email}</p>
        </div>
      </div>
    ),
  },
  {
    id: "location",
    header: "Location",
    accessorFn: (c) => `${c.city}, ${c.country}`,
    cell: ({ getValue }) => <span className="text-subtle">{getValue() as string}</span>,
  },
  {
    accessorKey: "orders",
    header: ({ column }) => <SortHeader label="Orders" column={column} />,
    cell: ({ getValue }) => <span className="tabular-nums">{getValue() as number}</span>,
  },
  {
    accessorKey: "spent",
    header: ({ column }) => <SortHeader label="Spent" column={column} />,
    cell: ({ getValue }) => <span className="font-medium tabular-nums text-ink">{formatMoney(getValue() as number)}</span>,
  },
  {
    id: "last",
    accessorFn: (c) => c.lastOrder ?? "",
    header: ({ column }) => <SortHeader label="Last order" column={column} />,
    cell: ({ row }) => <span className="text-subtle">{row.original.lastOrder ? formatRelative(row.original.lastOrder) : "Never"}</span>,
  },
  {
    accessorKey: "joinedAt",
    header: "Joined",
    cell: ({ row }) => <span className="whitespace-nowrap text-subtle">{formatDate(row.original.joinedAt)}</span>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) =>
      row.original.status === "locked" ? (
        <Badge className="rounded-full border-transparent bg-danger/10 text-danger">Locked</Badge>
      ) : row.original.verified ? (
        <Badge variant="outline" className="rounded-full">Active</Badge>
      ) : (
        <Badge className="rounded-full border-transparent bg-surface-2 text-subtle">Unverified</Badge>
      ),
  },
];

export function CustomersTable() {
  const router = useRouter();
  const [segment, setSegment] = useState<"all" | "vip" | "new" | "locked">("all");
  const rows: Row[] = customers.map((c) => ({ ...c, ...customerStats(c.id) }));
  const vipCut = [...rows].sort((a, b) => b.spent - a.spent)[Math.floor(rows.length * 0.2)]?.spent ?? 0;

  const visible = rows.filter((r) =>
    segment === "all"
      ? true
      : segment === "vip"
        ? r.spent >= vipCut
        : segment === "new"
          ? Date.parse("2026-10-10") - Date.parse(r.joinedAt) < 45 * 86400000
          : r.status === "locked",
  );

  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
  const repeat = rows.filter((r) => r.orders > 1).length;

  return (
    <>
      <PageHeader title="Customers" description="Everyone who has an account or placed an order." />

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Customers" value={String(rows.length)} change={0.083} hint="new this month" />
        <StatCard label="Repeat buyers" value={`${Math.round((repeat / rows.length) * 100)}%`} hint="ordered more than once" />
        <StatCard label="Lifetime value" value={formatMoney(totalSpent / rows.length)} hint="average per customer" />
        <StatCard label="Locked accounts" value={String(rows.filter((r) => r.status === "locked").length)} hint="too many login attempts" />
      </div>

      <Tabs value={segment} onValueChange={(v) => setSegment(v as typeof segment)} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="vip">Top 20%</TabsTrigger>
          <TabsTrigger value="new">New</TabsTrigger>
          <TabsTrigger value="locked">Locked</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable
        columns={columns}
        data={visible}
        getRowId={(c) => c.id}
        searchPlaceholder="Search name, email or city"
        globalFilterFn={(c, q) => [c.name, c.email, c.city, c.country].some((v) => v.toLowerCase().includes(q))}
        onRowClick={(c) => router.push(`/admin/customers/${c.id}`)}
        emptyText="No customers in this segment."
      />
    </>
  );
}

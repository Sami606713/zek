"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { DownloadSimple, Package, Truck } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
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
import { ChannelLabel, FulfilmentBadge, PaymentBadge } from "@/components/admin/badges";
import {
  adminOrders,
  channelLabels,
  getCustomer,
  type AdminOrder,
  type Channel,
  type FulfilmentStatus,
} from "@/lib/admin/mock";
import { formatDate, formatMoney, formatRelative } from "@/lib/admin/format";

const tabs = [
  { value: "all", label: "All" },
  { value: "to-ship", label: "To ship" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
] as const;
type TabValue = (typeof tabs)[number]["value"];

const inTab = (o: AdminOrder, tab: TabValue) =>
  tab === "all" ||
  (tab === "to-ship" && (o.status === "confirmed" || o.status === "packed")) ||
  o.status === tab;

function toCsv(rows: AdminOrder[]) {
  const header = ["Order", "Date", "Customer", "Email", "Channel", "Status", "Payment", "Total"];
  const lines = rows.map((o) => {
    const c = getCustomer(o.customerId);
    return [o.id, o.createdAt, c?.name, c?.email, o.channel, o.status, o.payment.status, o.totals.total.toFixed(2)]
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
      .join(",");
  });
  return [header.join(","), ...lines].join("\n");
}

function download(rows: AdminOrder[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `zek-orders-${rows.length}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const columns: ColumnDef<AdminOrder, unknown>[] = [
  {
    accessorKey: "id",
    header: "Order",
    cell: ({ row }) => (
      <div>
        <p className="font-mono font-medium text-ink">{row.original.id}</p>
        <p className="text-[12px] text-subtle">{formatRelative(row.original.createdAt)}</p>
      </div>
    ),
  },
  {
    id: "customer",
    header: "Customer",
    accessorFn: (o) => getCustomer(o.customerId)?.name ?? "",
    cell: ({ row }) => {
      const c = getCustomer(row.original.customerId);
      return (
        <div className="min-w-0">
          <p className="truncate text-ink">{c?.name}</p>
          <p className="truncate text-[12px] text-subtle">{c?.email}</p>
        </div>
      );
    },
  },
  {
    accessorKey: "channel",
    header: "Channel",
    cell: ({ row }) => <ChannelLabel channel={row.original.channel} />,
  },
  {
    id: "items",
    header: "Items",
    accessorFn: (o) => o.lines.reduce((n, l) => n + l.quantity, 0),
    cell: ({ getValue }) => <span className="tabular-nums">{getValue() as number}</span>,
  },
  {
    id: "payment",
    header: "Payment",
    accessorFn: (o) => o.payment.status,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <PaymentBadge status={row.original.payment.status} />
        <span className="hidden text-[12px] text-subtle xl:inline">
          {row.original.payment.method === "card" ? `Card ${row.original.payment.last4}` : "COD"}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Fulfilment",
    cell: ({ row }) => <FulfilmentBadge status={row.original.status} />,
  },
  {
    id: "date",
    accessorFn: (o) => o.createdAt,
    header: ({ column }) => <SortHeader label="Date" column={column} />,
    cell: ({ row }) => <span className="whitespace-nowrap text-subtle">{formatDate(row.original.createdAt)}</span>,
  },
  {
    id: "total",
    accessorFn: (o) => o.totals.total,
    header: ({ column }) => (
      <div className="text-right">
        <SortHeader label="Total" column={column} />
      </div>
    ),
    cell: ({ row }) => (
      <p className="text-right font-medium tabular-nums text-ink">{formatMoney(row.original.totals.total)}</p>
    ),
  },
];

export function OrdersTable() {
  const router = useRouter();
  const params = useSearchParams();
  const initialStatus = params.get("status");
  const [orders, setOrders] = useState(adminOrders);
  const [tab, setTab] = useState<TabValue>(
    initialStatus === "confirmed" || initialStatus === "packed" ? "to-ship" : "all",
  );
  const [channel, setChannel] = useState<"all" | Channel>("all");
  const [payment, setPayment] = useState(params.get("payment") ?? "all");

  const visible = orders.filter(
    (o) =>
      inTab(o, tab) &&
      (channel === "all" || o.channel === channel) &&
      (payment === "all" || o.payment.status === payment),
  );

  const setStatus = (ids: string[], status: FulfilmentStatus) => {
    setOrders((prev) => prev.map((o) => (ids.includes(o.id) && o.status !== "cancelled" ? { ...o, status } : o)));
    toast.success(`${ids.length} ${ids.length === 1 ? "order" : "orders"} marked as ${status}`, {
      description: "Demo mode: changes reset when you reload.",
    });
  };

  return (
    <>
      <PageHeader
        title="Orders"
        description={`${orders.length} orders in the last 60 days`}
        actions={
          <Button variant="outline" onClick={() => download(visible)}>
            <DownloadSimple /> Export CSV
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)} className="mb-4">
        <TabsList className="h-auto flex-wrap">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
              {t.label}
              <span className="text-[11px] tabular-nums text-subtle">{orders.filter((o) => inTab(o, t.value)).length}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <DataTable
        columns={columns}
        data={visible}
        getRowId={(o) => o.id}
        initialSearch={params.get("q") ?? ""}
        searchPlaceholder="Search order, customer or product"
        globalFilterFn={(o, q) => {
          const c = getCustomer(o.customerId);
          return (
            o.id.toLowerCase().includes(q) ||
            Boolean(c?.name.toLowerCase().includes(q)) ||
            Boolean(c?.email.toLowerCase().includes(q)) ||
            o.lines.some((l) => l.name.toLowerCase().includes(q))
          );
        }}
        toolbar={
          <>
            <Select value={channel} onValueChange={(v) => setChannel(v as "all" | Channel)}>
              <SelectTrigger className="h-9 w-40 bg-surface" aria-label="Channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                {(Object.keys(channelLabels) as Channel[]).map((c) => (
                  <SelectItem key={c} value={c}>
                    {channelLabels[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={payment} onValueChange={setPayment}>
              <SelectTrigger className="h-9 w-40 bg-surface" aria-label="Payment status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All payments</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        selectable
        bulkActions={(rows, table) => (
          <>
            <Button size="sm" variant="outline" onClick={() => { setStatus(rows.map((r) => r.id), "packed"); table.resetRowSelection(); }}>
              <Package /> Mark packed
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setStatus(rows.map((r) => r.id), "shipped"); table.resetRowSelection(); }}>
              <Truck /> Mark shipped
            </Button>
            <Button size="sm" variant="outline" onClick={() => download(rows)}>
              <DownloadSimple /> Export
            </Button>
          </>
        )}
        onRowClick={(o) => router.push(`/admin/orders/${o.id}`)}
        emptyText="No orders match these filters."
      />
    </>
  );
}

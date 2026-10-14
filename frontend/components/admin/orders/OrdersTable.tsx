"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { DownloadSimple, Package, Truck } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/admin/DataTable";
import { PageHeader } from "@/components/admin/PageHeader";
import { ErrorState, TableSkeleton } from "@/components/admin/states";
import { ChannelLabel, FulfilmentBadge, PaymentBadge } from "@/components/admin/badges";
import { channelLabels, type Channel } from "@/lib/admin/mock";
import { formatDate, formatMoney, formatRelative } from "@/lib/admin/format";
import { errorMessage, useAdminQuery } from "@/lib/admin/useAdminQuery";
import {
  adminOrders,
  type AdminOrderRow,
  type OrderListQuery,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/api/admin";

const PAGE_SIZE = 20;

const tabs = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "To pack" },
  { value: "packed", label: "Packed" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "returned", label: "Returned" },
] as const;
type TabValue = (typeof tabs)[number]["value"];

const payments: { value: PaymentStatus; label: string }[] = [
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "partially_refunded", label: "Part refunded" },
  { value: "refunded", label: "Refunded" },
];

const periods = [
  { value: "all", label: "Any time", days: 0 },
  { value: "1", label: "Today", days: 1 },
  { value: "7", label: "Last 7 days", days: 7 },
  { value: "30", label: "Last 30 days", days: 30 },
  { value: "90", label: "Last 90 days", days: 90 },
] as const;

/** YYYY-MM-DD for `days - 1` days ago (so "Today" starts today). */
function since(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString().slice(0, 10);
}

const isTab = (v: string | null): v is TabValue => tabs.some((t) => t.value === v);

// ── CSV ─────────────────────────────────────────────────────────────────────

function toCsv(rows: AdminOrderRow[]) {
  const header = ["Order", "Date", "Customer", "Email", "Channel", "Status", "Payment", "Items", "Total"];
  const lines = rows.map((o) =>
    [o.order_number, o.created_at, o.customer_name, o.email, o.channel, o.status, o.payment_status, o.item_count, o.total]
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

function download(rows: AdminOrderRow[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `zek-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Every order matching the filters, 100 at a time (the API's max page size). */
async function fetchAll(query: OrderListQuery) {
  const rows: AdminOrderRow[] = [];
  for (let skip = 0; skip < 5000; skip += 100) {
    const page = await adminOrders.list({ ...query, skip, limit: 100 });
    rows.push(...page.items);
    if (rows.length >= page.total || page.items.length === 0) break;
  }
  return rows;
}

// ── Columns ─────────────────────────────────────────────────────────────────

const columns: ColumnDef<AdminOrderRow, unknown>[] = [
  {
    accessorKey: "order_number",
    header: "Order",
    cell: ({ row }) => (
      <div>
        <p className="font-mono font-medium text-ink">{row.original.order_number}</p>
        <p className="text-[12px] text-subtle">{formatRelative(row.original.created_at)}</p>
      </div>
    ),
  },
  {
    id: "customer",
    header: "Customer",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate text-ink">{row.original.customer_name || "Guest"}</p>
        <p className="truncate text-[12px] text-subtle">{row.original.email}</p>
      </div>
    ),
  },
  {
    accessorKey: "channel",
    header: "Channel",
    cell: ({ row }) => <ChannelLabel channel={row.original.channel} />,
  },
  {
    accessorKey: "item_count",
    header: "Items",
    cell: ({ row }) => <span className="tabular-nums">{row.original.item_count}</span>,
  },
  {
    id: "payment",
    header: "Payment",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <PaymentBadge status={row.original.payment_status} />
        <span className="hidden text-[12px] text-subtle xl:inline">
          {row.original.payment_method === "card" ? "Card" : "COD"}
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
    header: "Date",
    cell: ({ row }) => <span className="whitespace-nowrap text-subtle">{formatDate(row.original.created_at)}</span>,
  },
  {
    id: "total",
    header: () => <div className="text-right">Total</div>,
    cell: ({ row }) => (
      <p className="text-right font-medium tabular-nums text-ink">{formatMoney(Number(row.original.total))}</p>
    ),
  },
];

// ── Page ────────────────────────────────────────────────────────────────────

export function OrdersTable() {
  const params = useSearchParams();
  // The top bar search links here with ?q=; remount so a new search replaces the filters.
  return <Orders key={params.toString()} />;
}

function Orders() {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<TabValue>(isTab(params.get("status")) ? (params.get("status") as TabValue) : "all");
  const [channel, setChannel] = useState<"all" | Channel>("all");
  const [payment, setPayment] = useState<"all" | PaymentStatus>(
    (payments.find((p) => p.value === params.get("payment"))?.value ?? "all") as "all" | PaymentStatus,
  );
  const [period, setPeriod] = useState<(typeof periods)[number]["value"]>("all");
  const [searchInput, setSearchInput] = useState(params.get("q") ?? "");
  const [q, setQ] = useState(searchInput.trim());
  const [page, setPage] = useState(0);
  const [working, setWorking] = useState(false);

  // Search after the admin stops typing.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(searchInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const days = periods.find((p) => p.value === period)!.days;
  const filters: OrderListQuery = {
    channel: channel === "all" ? undefined : channel,
    payment_status: payment === "all" ? undefined : payment,
    date_from: days ? since(days) : undefined,
    q: q || undefined,
  };
  const query: OrderListQuery = {
    ...filters,
    status: tab === "all" ? undefined : (tab as OrderStatus),
    skip: page * PAGE_SIZE,
    limit: PAGE_SIZE,
  };

  const orders = useAdminQuery(JSON.stringify(query), () => adminOrders.list(query));

  // Tab counts with the same filters (one tiny request per tab).
  const counts = useAdminQuery(`counts:${JSON.stringify(filters)}`, async () => {
    const totals = await Promise.all(
      tabs.map((t) =>
        adminOrders
          .list({ ...filters, status: t.value === "all" ? undefined : (t.value as OrderStatus), limit: 1 })
          .then((r) => r.total),
      ),
    );
    return Object.fromEntries(tabs.map((t, i) => [t.value, totals[i]])) as Record<TabValue, number>;
  });

  const resetPage = <V,>(set: (v: V) => void) => (v: V) => {
    set(v);
    setPage(0);
  };

  const filtered = Boolean(q || channel !== "all" || payment !== "all" || period !== "all");
  const clearFilters = () => {
    setSearchInput("");
    setQ("");
    setChannel("all");
    setPayment("all");
    setPeriod("all");
    setPage(0);
  };

  /** Moves each selected order that can make the move; skips the rest. */
  const bulkStatus = async (rows: AdminOrderRow[], from: OrderStatus, to: OrderStatus) => {
    const eligible = rows.filter((r) => r.status === from);
    if (eligible.length === 0) {
      toast.error(`None of the selected orders can be marked ${to}`, {
        description: `Only ${from} orders can move to ${to}.`,
      });
      return;
    }
    setWorking(true);
    const results = await Promise.allSettled(eligible.map((r) => adminOrders.update(r.id, { status: to })));
    setWorking(false);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    const skipped = rows.length - eligible.length;
    if (ok) {
      toast.success(`${ok} ${ok === 1 ? "order" : "orders"} marked ${to}`, {
        description: skipped ? `${skipped} skipped (not ${from}).` : undefined,
      });
    }
    if (failed) toast.error(errorMessage(failed.reason));
    orders.refetch();
    counts.refetch();
  };

  const exportAll = async () => {
    setWorking(true);
    try {
      const rows = await fetchAll({ ...filters, status: query.status });
      download(rows);
      toast.success(`Exported ${rows.length} ${rows.length === 1 ? "order" : "orders"}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setWorking(false);
    }
  };

  const total = orders.data?.total ?? 0;

  return (
    <>
      <PageHeader
        title="Orders"
        description={counts.data ? `${counts.data.all} ${counts.data.all === 1 ? "order" : "orders"}${filtered ? " match these filters" : " in total"}` : "Loading orders…"}
        actions={
          <Button variant="outline" onClick={exportAll} disabled={working || total === 0}>
            {working ? <Spinner /> : <DownloadSimple />} Export CSV
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => resetPage(setTab)(v as TabValue)} className="mb-4">
        <TabsList className="h-auto flex-wrap">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
              {t.label}
              {counts.data && <span className="text-[11px] tabular-nums text-subtle">{counts.data[t.value]}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {orders.loading ? (
        <TableSkeleton columns={6} />
      ) : orders.error && !orders.data ? (
        <ErrorState error={orders.error} onRetry={orders.refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={orders.data?.items ?? []}
          getRowId={(o) => o.id}
          pageSize={PAGE_SIZE}
          server={{ total, pageIndex: page, onPageChange: setPage }}
          search={{ value: searchInput, onChange: setSearchInput }}
          busy={orders.refreshing || working}
          searchPlaceholder="Search order, customer or product"
          toolbar={
            <>
              <Select value={period} onValueChange={(v) => resetPage(setPeriod)(v as typeof period)}>
                <SelectTrigger className="h-9 w-36 bg-surface" aria-label="Date">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={channel} onValueChange={(v) => resetPage(setChannel)(v as "all" | Channel)}>
                <SelectTrigger className="h-9 w-36 bg-surface" aria-label="Channel">
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
              <Select value={payment} onValueChange={(v) => resetPage(setPayment)(v as "all" | PaymentStatus)}>
                <SelectTrigger className="h-9 w-36 bg-surface" aria-label="Payment status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All payments</SelectItem>
                  {payments.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filtered && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear
                </Button>
              )}
            </>
          }
          selectable
          bulkActions={(rows, table) => (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={working}
                onClick={async () => {
                  await bulkStatus(rows, "confirmed", "packed");
                  table.resetRowSelection();
                }}
              >
                <Package /> Mark packed
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={working}
                onClick={async () => {
                  await bulkStatus(rows, "packed", "shipped");
                  table.resetRowSelection();
                }}
              >
                <Truck /> Mark shipped
              </Button>
              <Button size="sm" variant="outline" onClick={() => download(rows)}>
                <DownloadSimple /> Export
              </Button>
            </>
          )}
          onRowClick={(o) => router.push(`/admin/orders/${o.id}`)}
          emptyText={filtered || tab !== "all" ? "No orders match these filters." : "No orders yet."}
        />
      )}

    </>
  );
}

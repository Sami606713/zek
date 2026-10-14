"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { StatCard } from "@/components/admin/StatCard";
import { CardsSkeleton, ErrorState, TableSkeleton } from "@/components/admin/states";
import { formatDate, formatMoney, formatRelative, initials } from "@/lib/admin/format";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import {
  adminCustomers,
  type CustomerListQuery,
  type CustomerRow,
  type CustomerSegment,
  type CustomerSort,
} from "@/lib/api/admin";

const PAGE_SIZE = 20;
type Tab = "all" | CustomerSegment;
const tabs: { value: Tab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "repeat", label: "Repeat buyers" },
  { value: "new", label: "New" },
  { value: "no_orders", label: "No orders" },
  { value: "admins", label: "Admins" },
  { value: "locked", label: "Locked" },
  { value: "inactive", label: "Turned off" },
];
const sorts: { value: CustomerSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "spent", label: "Top spenders" },
  { value: "orders", label: "Most orders" },
  { value: "last_order", label: "Recent buyers" },
  { value: "name", label: "Name" },
];

export const displayName = (c: Pick<CustomerRow, "full_name" | "username">) => c.full_name || c.username;

/** The one badge that matters most for this account. */
export function AccountBadge({ c }: { c: Pick<CustomerRow, "is_active" | "is_locked" | "is_verified"> }) {
  if (!c.is_active) return <Badge className="rounded-full border-transparent bg-surface-2 text-subtle">Turned off</Badge>;
  if (c.is_locked) return <Badge className="rounded-full border-transparent bg-danger/10 text-danger">Locked</Badge>;
  if (!c.is_verified) return <Badge className="rounded-full border-transparent bg-surface-2 text-subtle">Unverified</Badge>;
  return (
    <Badge variant="outline" className="rounded-full">
      Active
    </Badge>
  );
}

const columns: ColumnDef<CustomerRow, unknown>[] = [
  {
    id: "customer",
    header: "Customer",
    cell: ({ row }) => {
      const c = row.original;
      const admin = c.role === "admin" || c.is_superuser;
      return (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback className="bg-brand-soft text-[11px] font-semibold text-brand">{initials(displayName(c))}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate font-medium text-ink">
              {displayName(c)}
              {admin && <Badge className="rounded-full border-transparent bg-ink px-1.5 py-0 text-[10px] text-bg">Admin</Badge>}
            </p>
            <p className="truncate text-[12px] text-subtle">{c.email}</p>
          </div>
        </div>
      );
    },
  },
  {
    id: "location",
    header: "Location",
    cell: ({ row }) => <span className="text-subtle">{row.original.location ?? "Unknown"}</span>,
  },
  {
    id: "orders",
    header: "Orders",
    cell: ({ row }) => <span className="tabular-nums">{row.original.orders_count}</span>,
  },
  {
    id: "spent",
    header: "Spent",
    cell: ({ row }) => <span className="font-medium tabular-nums text-ink">{formatMoney(Number(row.original.total_spent))}</span>,
  },
  {
    id: "last",
    header: "Last order",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-subtle">{row.original.last_order_at ? formatRelative(row.original.last_order_at) : "Never"}</span>
    ),
  },
  {
    id: "joined",
    header: "Joined",
    cell: ({ row }) => <span className="whitespace-nowrap text-subtle">{formatDate(row.original.created_at)}</span>,
  },
  { id: "status", header: "Status", cell: ({ row }) => <AccountBadge c={row.original} /> },
];

export function CustomersTable() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [sort, setSort] = useState<CustomerSort>("newest");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const query: CustomerListQuery = {
    segment: tab === "all" ? undefined : tab,
    search: search || undefined,
    sort,
    skip: page * PAGE_SIZE,
    limit: PAGE_SIZE,
  };
  const list = useAdminQuery(JSON.stringify(query), () => adminCustomers.list(query));
  const summary = list.data?.summary;

  return (
    <>
      <PageHeader title="Customers" description="Everyone with an account, with what they've ordered." />

      {summary ? (
        <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard label="Customers" value={String(summary.customers)} hint={`${summary.new_30d} joined in the last 30 days`} />
          <StatCard label="Repeat buyers" value={`${Math.round(summary.repeat_rate * 100)}%`} hint="of buyers ordered more than once" />
          <StatCard label="Lifetime value" value={formatMoney(Number(summary.average_spent))} hint="average per buyer, after refunds" />
          <StatCard label="Locked accounts" value={String(summary.locked)} hint="too many login attempts" />
        </div>
      ) : (
        !list.error && (
          <div className="mb-6">
            <CardsSkeleton />
          </div>
        )
      )}

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as Tab);
          setPage(0);
        }}
        className="mb-4"
      >
        <TabsList className="h-auto flex-wrap">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {list.loading ? (
        <TableSkeleton columns={6} />
      ) : list.error && !list.data ? (
        <ErrorState error={list.error} onRetry={list.refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={list.data?.items ?? []}
          getRowId={(c) => c.id}
          pageSize={PAGE_SIZE}
          server={{ total: list.data?.total ?? 0, pageIndex: page, onPageChange: setPage }}
          search={{ value: searchInput, onChange: setSearchInput }}
          busy={list.refreshing}
          searchPlaceholder="Search name, email or phone"
          toolbar={
            <Select
              value={sort}
              onValueChange={(v) => {
                setSort(v as CustomerSort);
                setPage(0);
              }}
            >
              <SelectTrigger className="h-9 w-40 bg-surface" aria-label="Sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sorts.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
          onRowClick={(c) => router.push(`/admin/customers/${c.id}`)}
          emptyText={search || tab !== "all" ? "No customers match." : "No customers yet."}
        />
      )}
    </>
  );
}

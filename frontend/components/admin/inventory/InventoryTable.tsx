"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { ArrowCounterClockwise, ImageSquare, Minus, Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
import { formatMoney } from "@/lib/admin/format";
import { unoptimized } from "@/lib/admin/images";
import { errorMessage, useAdminQuery } from "@/lib/admin/useAdminQuery";
import { adminInventory, type InventoryQuery, type InventoryRow, type StockLevel } from "@/lib/api/admin";

const PAGE_SIZE = 50;
type Filter = "all" | Exclude<StockLevel, "ok">;
const MAX = 1_000_000;
const clamp = (n: number) => Math.max(0, Math.min(MAX, Math.round(n) || 0));

const levelOf = (stock: number, threshold: number): StockLevel => (stock === 0 ? "out" : stock <= threshold ? "low" : "ok");

function LevelBadge({ level }: { level: StockLevel }) {
  return level === "out" ? (
    <Badge className="rounded-full border-transparent bg-danger/10 text-danger">Out of stock</Badge>
  ) : level === "low" ? (
    <Badge className="rounded-full border-transparent bg-brand-soft text-brand">Low</Badge>
  ) : (
    <Badge variant="outline" className="rounded-full">In stock</Badge>
  );
}

export function InventoryTable() {
  const params = useSearchParams();
  const initial = params.get("filter");
  const [filter, setFilter] = useState<Filter>(initial === "low" || initial === "out" ? initial : "all");
  const [sort, setSort] = useState<"name" | "stock">("name");
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  // Unsaved counts, by variant id. Kept across pages and filters until saved or reset.
  const [edits, setEdits] = useState<Record<string, { row: InventoryRow; count: number }>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(searchInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const query: InventoryQuery = {
    level: filter === "all" ? undefined : filter,
    q: q || undefined,
    sort,
    skip: page * PAGE_SIZE,
    limit: PAGE_SIZE,
  };
  const inventory = useAdminQuery(JSON.stringify(query), () => adminInventory.list(query));
  const summary = inventory.data?.summary;

  const countOf = (r: InventoryRow) => edits[r.variant_id]?.count ?? r.stock_qty;
  const setCount = (r: InventoryRow, n: number) =>
    setEdits((prev) => {
      const count = clamp(n);
      const next = { ...prev };
      if (count === r.stock_qty) delete next[r.variant_id];
      else next[r.variant_id] = { row: r, count };
      return next;
    });

  const changed = Object.values(edits);

  const save = async () => {
    setSaving(true);
    const results = await Promise.allSettled(
      changed.map(({ row, count }) => adminInventory.setStock(row.product_id, row.variant_id, count, "Inventory count")),
    );
    setSaving(false);
    const failedIds = new Set<string>();
    let firstError: unknown;
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        failedIds.add(changed[i].row.variant_id);
        firstError ??= r.reason;
      }
    });
    const ok = results.length - failedIds.size;
    if (ok) toast.success(`Stock saved for ${ok} ${ok === 1 ? "variant" : "variants"}`);
    if (failedIds.size) toast.error(`${failedIds.size} didn't save`, { description: errorMessage(firstError) });
    // Keep only the edits that failed, so they can be retried.
    setEdits((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => failedIds.has(id))));
    inventory.refetch();
  };

  const columns: ColumnDef<InventoryRow, unknown>[] = [
    {
      id: "product",
      header: "Product",
      cell: ({ row }) => {
        const r = row.original;
        const option = [r.color_name, r.size].filter(Boolean).join(" / ");
        return (
          <Link href={`/admin/products/${r.product_id}`} className="flex items-center gap-3 hover:opacity-80">
            <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-2 text-subtle">
              {r.image_url ? (
                <Image src={r.image_url} alt="" fill sizes="40px" className="object-cover" unoptimized={unoptimized(r.image_url)} />
              ) : (
                <ImageSquare size={18} />
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium text-ink">
                {r.product_name}
                {r.product_status === "draft" && <span className="ml-1.5 text-[12px] font-normal text-subtle">(draft)</span>}
              </span>
              <span className="flex items-center gap-1.5 text-[12px] text-subtle">
                {r.color_hex && <span className="size-2.5 shrink-0 rounded-full border border-line" style={{ background: r.color_hex }} />}
                {option && <span className="truncate">{option}</span>}
                <span className="truncate font-mono">{r.sku}</span>
              </span>
            </span>
          </Link>
        );
      },
    },
    {
      id: "level",
      header: "Status",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <span className="flex flex-col items-start gap-1">
            <LevelBadge level={levelOf(countOf(r), r.low_stock_threshold)} />
            {!r.is_active && <span className="text-[11px] text-subtle">Not for sale</span>}
          </span>
        );
      },
    },
    {
      id: "stock",
      header: "On hand",
      cell: ({ row }) => {
        const r = row.original;
        const count = countOf(r);
        const dirty = r.variant_id in edits;
        return (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" aria-label={`Decrease ${r.sku} stock`} onClick={() => setCount(r, count - 1)} disabled={count === 0 || saving}>
              <Minus />
            </Button>
            <Input
              aria-label={`${r.sku} stock`}
              inputMode="numeric"
              value={count}
              onChange={(e) => setCount(r, Number(e.target.value.replace(/\D/g, "")))}
              disabled={saving}
              className={`h-7 w-16 text-center tabular-nums ${dirty ? "border-brand ring-1 ring-brand/30" : ""}`}
            />
            <Button variant="outline" size="icon-sm" aria-label={`Increase ${r.sku} stock`} onClick={() => setCount(r, count + 1)} disabled={saving}>
              <Plus />
            </Button>
            {dirty && <span className="ml-1 text-[12px] tabular-nums text-subtle">was {r.stock_qty}</span>}
          </div>
        );
      },
    },
    {
      id: "threshold",
      header: "Alert at",
      cell: ({ row }) => <span className="tabular-nums text-subtle">{row.original.low_stock_threshold}</span>,
    },
    {
      id: "price",
      header: "Price",
      cell: ({ row }) => <span className="tabular-nums">{formatMoney(Number(row.original.effective_price))}</span>,
    },
    {
      id: "value",
      header: "Value",
      cell: ({ row }) => (
        <span className="tabular-nums">{formatMoney(countOf(row.original) * Number(row.original.effective_price))}</span>
      ),
    },
    {
      id: "restock",
      header: "",
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" disabled={saving} onClick={() => setCount(row.original, countOf(row.original) + 20)}>
          +20
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Inventory" description="Stock for every variant of active and draft products." />

      {summary ? (
        <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard label="Units on hand" value={summary.units.toLocaleString("en-US")} hint={`across ${summary.variants} variants`} />
          <StatCard label="Inventory value" value={formatMoney(Number(summary.value))} hint="at selling price" />
          <StatCard label="Low stock" value={String(summary.low)} hint="at or under alert level" />
          <StatCard label="Out of stock" value={String(summary.out)} hint="can't be ordered" />
        </div>
      ) : (
        !inventory.error && (
          <div className="mb-6">
            <CardsSkeleton />
          </div>
        )
      )}

      <Tabs
        value={filter}
        onValueChange={(v) => {
          setFilter(v as Filter);
          setPage(0);
        }}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="low" className="gap-1.5">
            Low {summary && <span className="text-[11px] tabular-nums text-subtle">{summary.low}</span>}
          </TabsTrigger>
          <TabsTrigger value="out" className="gap-1.5">
            Out {summary && <span className="text-[11px] tabular-nums text-subtle">{summary.out}</span>}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {inventory.loading ? (
        <TableSkeleton columns={6} />
      ) : inventory.error && !inventory.data ? (
        <ErrorState error={inventory.error} onRetry={inventory.refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={inventory.data?.items ?? []}
          getRowId={(r) => r.variant_id}
          pageSize={PAGE_SIZE}
          server={{ total: inventory.data?.total ?? 0, pageIndex: page, onPageChange: setPage }}
          search={{ value: searchInput, onChange: setSearchInput }}
          busy={inventory.refreshing || saving}
          searchPlaceholder="Search product, SKU, color or size"
          toolbar={
            <Select
              value={sort}
              onValueChange={(v) => {
                setSort(v as "name" | "stock");
                setPage(0);
              }}
            >
              <SelectTrigger className="h-9 w-44 bg-surface" aria-label="Sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Sort by name</SelectItem>
                <SelectItem value="stock">Lowest stock first</SelectItem>
              </SelectContent>
            </Select>
          }
          emptyText={
            filter === "out"
              ? "Nothing is out of stock."
              : filter === "low"
                ? "Nothing is low. Every variant is above its alert level."
                : q
                  ? "No variants match this search."
                  : "No products to track yet."
          }
        />
      )}

      {changed.length > 0 && (
        <div className="sticky bottom-0 z-20 -mx-4 -mb-6 mt-6 border-t border-line bg-bg/90 backdrop-blur-xl md:-mx-6 md:-mb-8">
          <div className="flex items-center justify-end gap-2 px-4 py-3 md:px-6">
            <p className="mr-auto text-[13px] text-ink">
              {changed.length} {changed.length === 1 ? "variant" : "variants"} changed
            </p>
            <Button variant="outline" onClick={() => setEdits({})} disabled={saving}>
              <ArrowCounterClockwise /> Reset
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Spinner />} Save stock
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

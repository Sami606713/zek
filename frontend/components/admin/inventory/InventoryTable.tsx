"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { ArrowCounterClockwise, Minus, Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DataTable, SortHeader } from "@/components/admin/DataTable";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { adminProducts, type AdminProduct } from "@/lib/admin/mock";
import { formatMoney } from "@/lib/admin/format";

type Filter = "all" | "low" | "out";
const level = (p: AdminProduct) => (p.stock === 0 ? "out" : p.stock <= p.lowStockThreshold ? "low" : "ok");

export function InventoryTable() {
  const params = useSearchParams();
  const tracked = adminProducts.filter((p) => p.status !== "archived");
  const [saved, setSaved] = useState<Record<string, number>>(() => Object.fromEntries(tracked.map((p) => [p.id, p.stock])));
  const [stock, setStock] = useState(saved);
  const [filter, setFilter] = useState<Filter>((params.get("filter") as Filter) ?? "all");

  const rows = tracked.map((p) => ({ ...p, stock: stock[p.id] }));
  const changed = tracked.filter((p) => stock[p.id] !== saved[p.id]);
  const visible = rows.filter((p) => filter === "all" || level(p) === filter);

  const units = rows.reduce((s, p) => s + p.stock, 0);
  const value = rows.reduce((s, p) => s + p.stock * p.price, 0);
  const lowCount = rows.filter((p) => level(p) === "low").length;
  const outCount = rows.filter((p) => level(p) === "out").length;

  const set = (id: string, n: number) => setStock((prev) => ({ ...prev, [id]: Math.max(0, Math.min(9999, Math.round(n) || 0)) }));

  const columns: ColumnDef<AdminProduct, unknown>[] = [
    {
      id: "product",
      accessorFn: (p) => p.name,
      header: ({ column }) => <SortHeader label="Product" column={column} />,
      cell: ({ row }) => (
        <Link href={`/admin/products/${row.original.id}`} className="flex items-center gap-3 hover:opacity-80">
          <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-surface-2">
            <Image src={row.original.image} alt="" fill sizes="40px" className="object-cover" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium text-ink">{row.original.name}</span>
            <span className="block font-mono text-[12px] text-subtle">{row.original.id.toUpperCase()}</span>
          </span>
        </Link>
      ),
    },
    {
      id: "level",
      header: "Status",
      accessorFn: (p) => level(p),
      cell: ({ row }) => {
        const l = level(row.original);
        return l === "out" ? (
          <Badge className="rounded-full border-transparent bg-danger/10 text-danger">Out of stock</Badge>
        ) : l === "low" ? (
          <Badge className="rounded-full border-transparent bg-brand-soft text-brand">Low</Badge>
        ) : (
          <Badge variant="outline" className="rounded-full">In stock</Badge>
        );
      },
    },
    {
      accessorKey: "stock",
      header: ({ column }) => <SortHeader label="On hand" column={column} />,
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" aria-label={`Decrease ${p.name} stock`} onClick={() => set(p.id, p.stock - 1)} disabled={p.stock === 0}>
              <Minus />
            </Button>
            <Input
              aria-label={`${p.name} stock`}
              inputMode="numeric"
              value={p.stock}
              onChange={(e) => set(p.id, Number(e.target.value.replace(/\D/g, "")))}
              className="h-7 w-16 text-center tabular-nums"
            />
            <Button variant="outline" size="icon-sm" aria-label={`Increase ${p.name} stock`} onClick={() => set(p.id, p.stock + 1)}>
              <Plus />
            </Button>
          </div>
        );
      },
    },
    {
      accessorKey: "lowStockThreshold",
      header: "Alert at",
      cell: ({ row }) => <span className="tabular-nums text-subtle">{row.original.lowStockThreshold}</span>,
    },
    {
      accessorKey: "sold30d",
      header: ({ column }) => <SortHeader label="Sold (30d)" column={column} />,
      cell: ({ row }) => {
        const p = row.original;
        const perDay = p.sold30d / 30;
        const daysLeft = perDay > 0 ? Math.floor(p.stock / perDay) : null;
        return (
          <span className="tabular-nums">
            {p.sold30d}
            {daysLeft !== null && p.stock > 0 && (
              <span className={`ml-2 text-[12px] ${daysLeft < 7 ? "text-brand" : "text-subtle"}`}>~{daysLeft} days left</span>
            )}
          </span>
        );
      },
    },
    {
      id: "value",
      header: "Value",
      accessorFn: (p) => p.stock * p.price,
      cell: ({ row }) => <span className="tabular-nums">{formatMoney(row.original.stock * row.original.price)}</span>,
    },
    {
      id: "restock",
      header: "",
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => set(row.original.id, row.original.stock + 20)}>
          +20
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Inventory" description="Stock on hand for every active and draft product." />

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Units on hand" value={units.toLocaleString("en-US")} hint="across all products" />
        <StatCard label="Inventory value" value={formatMoney(value)} hint="at retail price" />
        <StatCard label="Low stock" value={String(lowCount)} hint="at or under alert level" />
        <StatCard label="Out of stock" value={String(outCount)} hint="can't be ordered" />
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="low">Low ({lowCount})</TabsTrigger>
          <TabsTrigger value="out">Out ({outCount})</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable
        columns={columns}
        data={visible}
        getRowId={(p) => p.id}
        pageSize={20}
        searchPlaceholder="Search products"
        globalFilterFn={(p, q) => p.name.toLowerCase().includes(q) || p.id.includes(q)}
        emptyText="Nothing here. Every product is above its alert level."
      />

      {changed.length > 0 && (
        <div className="sticky bottom-0 z-20 -mx-4 -mb-6 mt-6 border-t border-line bg-bg/90 backdrop-blur-xl md:-mx-6 md:-mb-8">
          <div className="flex items-center justify-end gap-2 px-4 py-3 md:px-6">
            <p className="mr-auto text-[13px] text-ink">
              {changed.length} {changed.length === 1 ? "product" : "products"} changed
            </p>
            <Button variant="outline" onClick={() => setStock(saved)}>
              <ArrowCounterClockwise /> Reset
            </Button>
            <Button
              onClick={() => {
                setSaved(stock);
                toast.success("Stock levels saved", { description: `${changed.length} products updated. Demo mode.` });
              }}
            >
              Save changes
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

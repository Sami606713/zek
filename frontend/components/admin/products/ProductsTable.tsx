"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Archive, Eye, Plus, Star } from "@phosphor-icons/react";
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
import { ProductStatusBadge } from "@/components/admin/badges";
import { categories } from "@/lib/catalog";
import { adminProducts, type AdminProduct, type ProductStatus } from "@/lib/admin/mock";
import { formatMoney } from "@/lib/admin/format";

type Tab = "all" | ProductStatus;

const columns: ColumnDef<AdminProduct, unknown>[] = [
  {
    id: "product",
    accessorFn: (p) => p.name,
    header: ({ column }) => <SortHeader label="Product" column={column} />,
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-surface-2">
          <Image src={row.original.image} alt="" fill sizes="40px" className="object-cover" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{row.original.name}</p>
          <p className="truncate text-[12px] text-subtle">{row.original.brand}</p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => <span className="capitalize">{row.original.category}</span>,
  },
  {
    accessorKey: "price",
    header: ({ column }) => <SortHeader label="Price" column={column} />,
    cell: ({ row }) => (
      <div className="tabular-nums">
        <span className="text-ink">{formatMoney(row.original.price)}</span>
        {row.original.compareAt && (
          <span className="ml-1.5 text-[12px] text-subtle line-through">{formatMoney(row.original.compareAt)}</span>
        )}
      </div>
    ),
  },
  {
    accessorKey: "stock",
    header: ({ column }) => <SortHeader label="Stock" column={column} />,
    cell: ({ row }) => {
      const p = row.original;
      return (
        <span className={`tabular-nums ${p.stock === 0 ? "font-medium text-danger" : p.stock <= p.lowStockThreshold ? "font-medium text-brand" : "text-ink"}`}>
          {p.stock === 0 ? "Out of stock" : p.stock <= p.lowStockThreshold ? `${p.stock} left` : p.stock}
        </span>
      );
    },
  },
  {
    accessorKey: "sold30d",
    header: ({ column }) => <SortHeader label="Sold (30d)" column={column} />,
    cell: ({ row }) => <span className="tabular-nums">{row.original.sold30d}</span>,
  },
  {
    accessorKey: "rating",
    header: "Rating",
    cell: ({ row }) =>
      row.original.reviews ? (
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Star size={12} weight="fill" /> {row.original.rating.toFixed(1)}
          <span className="text-subtle">({row.original.reviews})</span>
        </span>
      ) : (
        <span className="text-subtle">None yet</span>
      ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <ProductStatusBadge status={row.original.status} />,
  },
];

export function ProductsTable() {
  const router = useRouter();
  const params = useSearchParams();
  const [products, setProducts] = useState(adminProducts);
  const [tab, setTab] = useState<Tab>("all");
  const [category, setCategory] = useState("all");

  const visible = products.filter(
    (p) => (tab === "all" || p.status === tab) && (category === "all" || p.category === category),
  );

  const setStatus = (ids: string[], status: ProductStatus) => {
    setProducts((prev) => prev.map((p) => (ids.includes(p.id) ? { ...p, status } : p)));
    toast.success(`${ids.length} ${ids.length === 1 ? "product" : "products"} set to ${status}`, {
      description: "Demo mode: changes reset when you reload.",
    });
  };

  const count = (t: Tab) => products.filter((p) => t === "all" || p.status === t).length;

  return (
    <>
      <PageHeader
        title="Products"
        description="Everything in the catalogue, including drafts."
        actions={
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus /> Add product
            </Link>
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mb-4">
        <TabsList>
          {(["all", "active", "draft", "archived"] as Tab[]).map((t) => (
            <TabsTrigger key={t} value={t} className="gap-1.5 capitalize">
              {t}
              <span className="text-[11px] tabular-nums text-subtle">{count(t)}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <DataTable
        columns={columns}
        data={visible}
        getRowId={(p) => p.id}
        initialSearch={params.get("q") ?? ""}
        searchPlaceholder="Search name or brand"
        globalFilterFn={(p, q) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)}
        toolbar={
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9 w-40 bg-surface" aria-label="Category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.slug} value={c.slug}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        selectable
        bulkActions={(rows, table) => (
          <>
            <Button size="sm" variant="outline" onClick={() => { setStatus(rows.map((r) => r.id), "active"); table.resetRowSelection(); }}>
              <Eye /> Publish
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setStatus(rows.map((r) => r.id), "archived"); table.resetRowSelection(); }}>
              <Archive /> Archive
            </Button>
          </>
        )}
        onRowClick={(p) => router.push(`/admin/products/${p.id}`)}
        emptyText="No products match. Try another search or category."
      />
    </>
  );
}

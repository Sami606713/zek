"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Archive, Eye, EyeSlash, ImageSquare, Plus, Star } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
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
import { ProductStatusBadge } from "@/components/admin/badges";
import { formatMoney } from "@/lib/admin/format";
import { unoptimized } from "@/lib/admin/images";
import { errorMessage, useAdminQuery } from "@/lib/admin/useAdminQuery";
import {
  adminCategories,
  adminProducts,
  type AdminProductRow,
  type ProductListQuery,
  type ProductSort,
  type ProductStatus,
} from "@/lib/api/admin";

const PAGE_SIZE = 20;
type Tab = "all" | ProductStatus;
const tabs: { value: Tab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
];
const sorts: { value: ProductSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name" },
  { value: "price_desc", label: "Price, high to low" },
  { value: "price_asc", label: "Price, low to high" },
  { value: "rating", label: "Top rated" },
  { value: "featured", label: "Featured first" },
];

const columns: ColumnDef<AdminProductRow, unknown>[] = [
  {
    id: "product",
    header: "Product",
    cell: ({ row }) => {
      const p = row.original;
      return (
        <div className="flex items-center gap-3">
          <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-2 text-subtle">
            {p.image ? (
              <Image src={p.image.url} alt="" fill sizes="40px" className="object-cover" unoptimized={unoptimized(p.image.url)} />
            ) : (
              <ImageSquare size={18} />
            )}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate font-medium text-ink">
              {p.name}
              {p.is_featured && <Star size={12} weight="fill" className="shrink-0 text-brand" aria-label="Featured" />}
            </p>
            <p className="truncate text-[12px] text-subtle">{p.brand ?? p.slug}</p>
          </div>
        </div>
      );
    },
  },
  {
    id: "category",
    header: "Category",
    cell: ({ row }) => <span className="text-ink">{row.original.category?.name ?? <span className="text-subtle">None</span>}</span>,
  },
  {
    id: "price",
    header: "Price",
    cell: ({ row }) => (
      <div className="whitespace-nowrap tabular-nums">
        <span className="text-ink">{formatMoney(Number(row.original.price))}</span>
        {row.original.compare_at_price && (
          <span className="ml-1.5 text-[12px] text-subtle line-through">{formatMoney(Number(row.original.compare_at_price))}</span>
        )}
      </div>
    ),
  },
  {
    id: "stock",
    header: "Stock",
    cell: ({ row }) => {
      const p = row.original;
      return (
        <span className={`tabular-nums ${!p.in_stock ? "font-medium text-danger" : p.is_low_stock ? "font-medium text-brand" : "text-ink"}`}>
          {!p.in_stock ? "Out of stock" : p.is_low_stock ? `${p.total_stock} left` : p.total_stock}
        </span>
      );
    },
  },
  {
    id: "rating",
    header: "Rating",
    cell: ({ row }) =>
      row.original.review_count ? (
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Star size={12} weight="fill" /> {row.original.rating_avg.toFixed(1)}
          <span className="text-subtle">({row.original.review_count})</span>
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
  const params = useSearchParams();
  // The top bar search links here with ?q=; remount so a new search replaces the filters.
  return <Products key={params.toString()} />;
}

function Products() {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<ProductSort>("newest");
  const [searchInput, setSearchInput] = useState(params.get("q") ?? "");
  const [q, setQ] = useState(searchInput.trim());
  const [page, setPage] = useState(0);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(searchInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const categories = useAdminQuery("categories", () => adminCategories.list({ limit: 100 }));

  const filters: ProductListQuery = { category: category === "all" ? undefined : category, q: q || undefined };
  const query: ProductListQuery = {
    ...filters,
    status: tab === "all" ? undefined : tab,
    sort,
    skip: page * PAGE_SIZE,
    limit: PAGE_SIZE,
  };
  const products = useAdminQuery(JSON.stringify(query), () => adminProducts.list(query));
  const counts = useAdminQuery(`counts:${JSON.stringify(filters)}`, async () => {
    const totals = await Promise.all(
      tabs.map((t) => adminProducts.list({ ...filters, status: t.value === "all" ? undefined : t.value, limit: 1 }).then((r) => r.total)),
    );
    return Object.fromEntries(tabs.map((t, i) => [t.value, totals[i]])) as Record<Tab, number>;
  });

  const resetPage = <V,>(set: (v: V) => void) => (v: V) => {
    set(v);
    setPage(0);
  };

  const setStatus = async (rows: AdminProductRow[], status: ProductStatus) => {
    const targets = rows.filter((r) => r.status !== status);
    if (targets.length === 0) return;
    setWorking(true);
    const results = await Promise.allSettled(targets.map((r) => adminProducts.update(r.id, { status })));
    setWorking(false);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    if (ok) toast.success(`${ok} ${ok === 1 ? "product" : "products"} set to ${status}`);
    if (failed) toast.error(errorMessage(failed.reason));
    products.refetch();
    counts.refetch();
  };

  const filtered = Boolean(q || category !== "all");

  return (
    <>
      <PageHeader
        title="Products"
        description="Everything in the catalogue, including drafts and archived products."
        actions={
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus /> Add product
            </Link>
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => resetPage(setTab)(v as Tab)} className="mb-4">
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
              {t.label}
              {counts.data && <span className="text-[11px] tabular-nums text-subtle">{counts.data[t.value]}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {products.loading ? (
        <TableSkeleton columns={6} />
      ) : products.error && !products.data ? (
        <ErrorState error={products.error} onRetry={products.refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={products.data?.items ?? []}
          getRowId={(p) => p.id}
          pageSize={PAGE_SIZE}
          server={{ total: products.data?.total ?? 0, pageIndex: page, onPageChange: setPage }}
          search={{ value: searchInput, onChange: setSearchInput }}
          busy={products.refreshing || working}
          searchPlaceholder="Search name, brand or tag"
          toolbar={
            <>
              <Select value={category} onValueChange={(v) => resetPage(setCategory)(v)}>
                <SelectTrigger className="h-9 w-40 bg-surface" aria-label="Category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.data?.items.map((c) => (
                    <SelectItem key={c.id} value={c.slug}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={(v) => resetPage(setSort)(v as ProductSort)}>
                <SelectTrigger className="h-9 w-44 bg-surface" aria-label="Sort">
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
              {filtered && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchInput("");
                    setQ("");
                    setCategory("all");
                    setPage(0);
                  }}
                >
                  Clear
                </Button>
              )}
            </>
          }
          selectable
          bulkActions={(rows, table) => (
            <>
              <Button size="sm" variant="outline" disabled={working} onClick={async () => { await setStatus(rows, "active"); table.resetRowSelection(); }}>
                <Eye /> Publish
              </Button>
              <Button size="sm" variant="outline" disabled={working} onClick={async () => { await setStatus(rows, "draft"); table.resetRowSelection(); }}>
                <EyeSlash /> Unpublish
              </Button>
              <Button size="sm" variant="outline" disabled={working} onClick={async () => { await setStatus(rows, "archived"); table.resetRowSelection(); }}>
                <Archive /> Archive
              </Button>
            </>
          )}
          onRowClick={(p) => router.push(`/admin/products/${p.id}`)}
          emptyText={filtered || tab !== "all" ? "No products match. Try another search or category." : "No products yet. Add your first one."}
        />
      )}
    </>
  );
}

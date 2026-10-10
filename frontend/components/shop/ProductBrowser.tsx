"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  CaretDown,
  MagnifyingGlass,
  SlidersHorizontal,
  X,
} from "@phosphor-icons/react";
import { fetchProducts, fetchCategories, mapProductListItem, mapCategory } from "@/lib/api/catalog";
import type { Product, Category } from "@/lib/catalog";
import {
  countActiveFilters,
  priceOptions,
  ratingOptions,
  readFilters,
  sortOptions,
} from "@/lib/productFilters";
import { FilterPanel } from "./FilterPanel";
import { ProductCard } from "./ProductCard";

const ease = [0.16, 1, 0.3, 1] as const;

export function ProductBrowser() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filters = readFilters(params);
  const [query, setQuery] = useState(filters.q);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories()
      .then((items) => setCategories(items.map(mapCategory)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const apiFilters: Record<string, string | number | boolean | undefined> = {
      category: filters.category,
      q: filters.q,
      min_price: filters.price?.includes("-") ? parseInt(filters.price.split("-")[0]) : undefined,
      max_price: filters.price?.includes("-") ? parseInt(filters.price.split("-")[1]) : undefined,
      min_rating: filters.rating,
      on_sale: filters.sale,
      featured: filters.fresh,
      sort: filters.sort !== "featured" ? filters.sort : undefined,
      limit: 100,
    };
    fetchProducts(apiFilters)
      .then((items) => setProducts(items.map(mapProductListItem)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params]);

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  useEffect(() => {
    if (query === filters.q) return;
    const id = window.setTimeout(() => update({ q: query.trim() || null }), 250);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const category = categories.find((c) => c.slug === filters.category);
  const title = filters.q
    ? `Results for "${filters.q}"`
    : category?.name ?? "Shop all";
  const activeCount = countActiveFilters(filters);

  const chips = [
    filters.price && {
      key: "price",
      label: priceOptions.find((p) => p.value === filters.price)?.label,
    },
    filters.rating && {
      key: "rating",
      label: ratingOptions.find((r) => r.value === filters.rating)?.label,
    },
    filters.sale && { key: "sale", label: "On sale" },
    filters.fresh && { key: "new", label: "New arrivals" },
  ].filter(Boolean) as { key: string; label: string }[];

  const clearAll = () => {
    setQuery("");
    update({ price: null, rating: null, sale: null, new: null, q: null });
  };

  const results = products;

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-24 pt-24 md:px-8 md:pt-28">
      <header>
        <motion.h1
          key={title}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="text-4xl font-semibold tracking-[-0.04em] text-ink md:text-6xl"
        >
          {title}
        </motion.h1>
        <p className="mt-3 max-w-[60ch] text-[16px] text-subtle">
          {category?.blurb ?? "Everything in the ZEK store, in one place."}
        </p>
      </header>

      <nav aria-label="Categories" className="no-scrollbar -mx-4 mt-8 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex w-max gap-2">
          {[{ slug: "", name: "All" }, ...categories].map((c) => {
            const active = filters.category === c.slug;
            return (
              <li key={c.slug || "all"} className="relative">
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => update({ category: c.slug || null })}
                  className={`relative z-10 rounded-full border px-4 py-2 text-[14px] font-medium transition-colors ${
                    active ? "border-transparent text-bg" : "border-line text-ink hover:bg-surface-2"
                  }`}
                >
                  {c.name}
                </button>
                {active && (
                  <motion.span
                    layoutId="category-pill"
                    className="absolute inset-0 rounded-full bg-ink"
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-6 flex flex-col gap-3 border-b border-line pb-6 sm:flex-row sm:items-center">
        <label className="relative flex-1 sm:max-w-sm">
          <span className="sr-only">Search products</span>
          <MagnifyingGlass
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-subtle"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products or brands"
            className="w-full rounded-full border border-line bg-surface py-2.5 pl-11 pr-4 text-[15px] text-ink outline-none transition placeholder:text-subtle focus:border-brand"
          />
        </label>

        <div className="flex items-center gap-2 sm:ml-auto">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2.5 text-[14px] font-medium text-ink transition hover:bg-surface-2 lg:hidden"
          >
            <SlidersHorizontal size={16} />
            Filters
            {activeCount > 0 && (
              <span className="grid min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] leading-5 text-brand-ink">
                {activeCount}
              </span>
            )}
          </button>

          <label className="relative">
            <span className="sr-only">Sort by</span>
            <select
              value={filters.sort}
              onChange={(e) => update({ sort: e.target.value === "featured" ? null : e.target.value })}
              className="appearance-none rounded-full border border-line bg-surface py-2.5 pl-4 pr-10 text-[14px] font-medium text-ink outline-none transition focus:border-brand"
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <CaretDown
              size={14}
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-subtle"
            />
          </label>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-12">
        <aside className="hidden lg:col-span-3 lg:block">
          <div className="sticky top-28">
            <FilterPanel filters={filters} onChange={update} />
          </div>
        </aside>

        <section aria-label="Products" className="lg:col-span-9">
          <div className="mb-6 flex min-h-8 flex-wrap items-center gap-2">
            <p className="mr-2 text-[14px] text-subtle" aria-live="polite">
              {results.length} {results.length === 1 ? "product" : "products"}
            </p>
            <AnimatePresence initial={false}>
              {chips.map((chip) => (
                <motion.button
                  key={chip.key}
                  type="button"
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => update({ [chip.key]: null })}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-[13px] font-medium text-ink"
                >
                  {chip.label}
                  <X size={12} weight="bold" aria-label={`Remove ${chip.label}`} />
                </motion.button>
              ))}
            </AnimatePresence>
            {chips.length > 1 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-[13px] font-medium text-subtle underline-offset-4 hover:text-ink hover:underline"
              >
                Clear all
              </button>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-10 md:gap-x-4 xl:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[4/5] rounded-[14px] bg-surface-2" />
                  <div className="mt-3 h-4 w-3/4 rounded-full bg-surface-2" />
                  <div className="mt-2 h-4 w-1/4 rounded-full bg-surface-2" />
                </div>
              ))}
            </div>
          ) : results.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-start gap-4 rounded-panel bg-surface px-6 py-14 md:px-10"
            >
              <MagnifyingGlass size={28} className="text-subtle" />
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-ink">
                No products match those filters
              </h2>
              <p className="max-w-[48ch] text-[15px] text-subtle">
                Try a different search, or remove a filter to see more of the store.
              </p>
              <button
                type="button"
                onClick={clearAll}
                className="mt-2 rounded-full bg-ink px-5 py-3 text-[14px] font-medium text-bg transition hover:opacity-90 active:scale-[0.98]"
              >
                Clear filters
              </button>
            </motion.div>
          ) : (
            <ul className="grid grid-cols-2 gap-x-3 gap-y-10 md:gap-x-4 xl:grid-cols-3">
              <AnimatePresence mode="popLayout" initial={false}>
                {results.map((product, i) => (
                  <motion.li
                    key={product.id}
                    layout
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.5, delay: Math.min(i, 8) * 0.04, ease }}
                  >
                    <ProductCard
                      product={product}
                      priority={i < 3}
                      sizes="(min-width: 1280px) 300px, (min-width: 1024px) 33vw, 50vw"
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </section>
      </div>

      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-50 bg-[#0e0f12]/50 lg:hidden"
            />
            <motion.div
              key="drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Filters"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-panel bg-bg lg:hidden"
            >
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <h2 className="text-[17px] font-semibold text-ink">Filters</h2>
                <button
                  type="button"
                  aria-label="Close filters"
                  onClick={() => setDrawerOpen(false)}
                  className="grid size-10 place-items-center rounded-full text-ink hover:bg-surface-2"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="overflow-y-auto px-5 py-6">
                <FilterPanel filters={filters} onChange={update} />
              </div>
              <div className="border-t border-line p-4">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="w-full rounded-full bg-ink py-3.5 text-[15px] font-medium text-bg active:scale-[0.98]"
                >
                  Show {results.length} {results.length === 1 ? "product" : "products"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

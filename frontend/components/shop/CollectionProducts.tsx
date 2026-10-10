"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CaretDown } from "@phosphor-icons/react";
import type { Product } from "@/lib/catalog";
import { applyFilters, readFilters, sortOptions } from "@/lib/productFilters";
import { ProductCard } from "./ProductCard";

const ease = [0.16, 1, 0.3, 1] as const;

export function CollectionProducts({ products }: { products: Product[] }) {
  const [sort, setSort] = useState("featured");
  const sorted = applyFilters([...products], {
    ...readFilters(new URLSearchParams()),
    sort,
  });

  return (
    <section aria-label="Products in this collection">
      <div className="flex items-center justify-between gap-4 border-b border-line pb-5">
        <p className="text-[14px] text-subtle">
          {products.length} {products.length === 1 ? "product" : "products"}
        </p>
        <label className="relative">
          <span className="sr-only">Sort by</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
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

      <ul className="mt-8 grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-3 md:gap-x-4 xl:grid-cols-4">
        <AnimatePresence mode="popLayout" initial={false}>
          {sorted.map((product, i) => (
            <motion.li
              key={product.id}
              layout
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.6, delay: Math.min(i, 8) * 0.05, ease }}
            >
              <ProductCard
                product={product}
                sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}

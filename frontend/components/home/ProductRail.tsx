"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import { fetchProducts, mapProductListItem } from "@/lib/api/catalog";
import type { Product } from "@/lib/catalog";
import { ProductCard } from "@/components/shop/ProductCard";

const ease = [0.16, 1, 0.3, 1] as const;

type ProductRailProps = {
  title?: string;
  products?: Product[];
};

export function ProductRail({
  title = "New this week",
  products: initialProducts,
}: ProductRailProps) {
  const trackRef = useRef<HTMLUListElement>(null);
  const reduce = useReducedMotion();
  const [products, setProducts] = useState<Product[]>(initialProducts ?? []);

  useEffect(() => {
    if (!initialProducts || initialProducts.length === 0) {
      fetchProducts({ sort: "newest", limit: 8 })
        .then((items) => setProducts(items.map(mapProductListItem)))
        .catch(() => {});
    }
  }, [initialProducts]);

  const scrollByCard = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector("li");
    const step = card ? card.getBoundingClientRect().width + 16 : 320;
    track.scrollBy({ left: step * direction, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto flex max-w-[1400px] items-end justify-between gap-6 px-4 md:px-8">
        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.8, ease }}
          className="text-4xl font-semibold tracking-[-0.04em] text-ink md:text-5xl"
        >
          {title}
        </motion.h2>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Previous products"
            onClick={() => scrollByCard(-1)}
            className="grid size-11 place-items-center rounded-full border border-line text-ink transition hover:bg-surface-2 active:scale-[0.96]"
          >
            <ArrowLeft size={18} />
          </button>
          <button
            type="button"
            aria-label="Next products"
            onClick={() => scrollByCard(1)}
            className="grid size-11 place-items-center rounded-full border border-line text-ink transition hover:bg-surface-2 active:scale-[0.96]"
          >
            <ArrowRight size={18} />
          </button>
        </div>
      </div>

      <ul
        ref={trackRef}
        className="no-scrollbar mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-4 md:scroll-px-8 md:px-8 xl:px-[max(2rem,calc((100vw-1400px)/2+2rem))] xl:scroll-px-[max(2rem,calc((100vw-1400px)/2+2rem))]"
      >
        {products.map((product, i) => (
          <motion.li
            key={product.id}
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, delay: Math.min(i, 4) * 0.07, ease }}
            className="w-[78%] shrink-0 snap-start sm:w-[44%] lg:w-[calc((100%-4rem)/4)] xl:w-[316px]"
          >
            <ProductCard
              product={product}
              sizes="(min-width: 1280px) 316px, (min-width: 1024px) 25vw, (min-width: 640px) 44vw, 78vw"
            />
          </motion.li>
        ))}
      </ul>
    </section>
  );
}

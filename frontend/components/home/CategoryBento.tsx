"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "@phosphor-icons/react/ssr";
import { fetchCategories, mapCategory } from "@/lib/api/catalog";
import type { Category } from "@/lib/catalog";
import { Reveal } from "@/components/motion/Reveal";

export function CategoryBento() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetchCategories()
      .then((items) => setCategories(items.map(mapCategory)))
      .catch(() => {});
  }, []);

  const [feature, ...rest] = categories;

  return (
    <section className="mx-auto max-w-[1400px] px-4 py-20 md:px-8 md:py-28">
      <Reveal className="mb-10 flex items-end justify-between gap-6">
        <h2 className="text-4xl font-semibold tracking-[-0.04em] text-ink md:text-5xl">
          Shop by category
        </h2>
        <Link
          href="/products"
          className="group hidden shrink-0 items-center gap-1.5 text-[15px] font-medium text-ink sm:inline-flex"
        >
          All categories
          <ArrowRight
            size={16}
            className="transition-transform duration-300 group-hover:translate-x-1"
          />
        </Link>
      </Reveal>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-4 lg:grid-rows-2">
        {feature && (
          <Reveal className="sm:col-span-2 lg:row-span-2">
            <CategoryTile category={feature} large />
          </Reveal>
        )}
        {rest.map((category, i) => (
          <Reveal key={category.slug} delay={0.08 * (i + 1)}>
            <CategoryTile category={category} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function CategoryTile({
  category,
  large = false,
}: {
  category: Category;
  large?: boolean;
}) {
  return (
    <Link
      href={`/products?category=${category.slug}`}
      className={`group relative block h-full overflow-hidden rounded-panel bg-surface-2 ${
        large ? "aspect-[4/5] sm:aspect-[16/11] lg:aspect-auto lg:min-h-[620px]" : "aspect-[4/3] lg:aspect-auto lg:min-h-[302px]"
      }`}
    >
      <Image
        src={category.image}
        alt=""
        fill
        sizes={large ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"}
        className="object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0e0f12]/75 via-[#0e0f12]/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 md:p-6">
        <div>
          <h3
            className={`font-semibold tracking-[-0.03em] text-[#f4f5f7] ${
              large ? "text-3xl md:text-4xl" : "text-2xl"
            }`}
          >
            {category.name}
          </h3>
          <p
            className={`mt-1 max-w-[36ch] text-[14px] leading-snug text-[#f4f5f7]/80 ${
              large ? "" : "hidden md:block"
            }`}
          >
            {category.blurb}
          </p>
        </div>
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f4f5f7] text-[#121316] transition-transform duration-500 group-hover:-rotate-45">
          <ArrowUpRight size={18} weight="bold" className="rotate-45" />
        </span>
      </div>
    </Link>
  );
}

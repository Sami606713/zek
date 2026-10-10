"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Heart, Plus, Star } from "@phosphor-icons/react";
import { formatPrice, type Product } from "@/lib/catalog";
import { useCartStore } from "@/store/cartStore";
import { useIsSaved, useWishlistStore } from "@/store/wishlistStore";

type ProductCardProps = {
  product: Product;
  sizes?: string;
  priority?: boolean;
};

export function ProductCard({
  product,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 44vw, 78vw",
  priority = false,
}: ProductCardProps) {
  const add = useCartStore((s) => s.add);
  const [added, setAdded] = useState(false);
  const saved = useIsSaved(product.id);
  const toggleSaved = useWishlistStore((s) => s.toggle);

  const handleAdd = () => {
    add(product.id);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  };

  return (
    <article className="group @container">
      <div className="relative aspect-[4/5] overflow-hidden rounded-panel bg-surface-2">
        <Link href={`/products/${product.id}`} aria-label={product.name} className="absolute inset-0">
          <Image
            src={product.image}
            alt={product.name}
            fill
            priority={priority}
            sizes={sizes}
            className="object-cover transition-transform duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.05]"
          />
        </Link>

        <button
          type="button"
          aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
          aria-pressed={saved}
          onClick={() => toggleSaved(product.id)}
          className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-surface/85 text-ink backdrop-blur-md transition active:scale-[0.92]"
        >
          <motion.span
            key={String(saved)}
            initial={{ scale: 0.6 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 15 }}
            className="grid"
          >
            <Heart
              size={17}
              weight={saved ? "fill" : "regular"}
              className={saved ? "text-brand" : ""}
            />
          </motion.span>
        </button>

        <motion.button
          type="button"
          onClick={handleAdd}
          whileTap={{ scale: 0.97 }}
          aria-label={added ? "Added to bag" : `Add ${product.name} to bag`}
          className="absolute bottom-3 right-3 flex size-10 items-center justify-center gap-2 rounded-full bg-ink text-[14px] font-medium text-bg transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] @[240px]:left-3 @[240px]:size-auto @[240px]:py-3 md:translate-y-[calc(100%+12px)] md:opacity-0 md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100 md:group-hover:translate-y-0 md:group-hover:opacity-100"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={added ? "added" : "add"}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="inline-flex items-center gap-2"
            >
              {added ? (
                <>
                  <Check size={16} weight="bold" />
                  <span className="hidden @[240px]:inline">Added to bag</span>
                </>
              ) : (
                <>
                  <Plus size={16} weight="bold" />
                  <span className="hidden @[240px]:inline">Add to bag</span>
                </>
              )}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </div>

      <div className="mt-3 flex flex-col gap-1 px-1 @[260px]:mt-4 @[260px]:flex-row @[260px]:items-start @[260px]:justify-between @[260px]:gap-4">
        <div className="min-w-0">
          <p className="text-[13px] text-subtle">{product.brand}</p>
          <h3 className="mt-0.5 text-[15px] font-medium leading-snug text-ink">
            <Link href={`/products/${product.id}`} className="hover:underline">
              {product.name}
            </Link>
          </h3>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[12px] text-subtle">
            <Star size={12} weight="fill" className="text-ink" />
            <span className="font-medium text-ink">{product.rating.toFixed(1)}</span>
            <span>({product.reviews})</span>
            {product.tag && (
              <span className="ml-2 font-medium text-brand">{product.tag}</span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-baseline gap-2 @[260px]:block @[260px]:text-right">
          <p className="text-[15px] font-medium text-ink">{formatPrice(product.price)}</p>
          {product.compareAt && (
            <p className="text-[13px] text-subtle line-through">
              {formatPrice(product.compareAt)}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

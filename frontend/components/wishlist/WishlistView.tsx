"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Bag, CaretDown, Check, Heart, Sparkle, X } from "@phosphor-icons/react";
import { formatPrice, type Product } from "@/lib/catalog";
import { fetchProducts, mapProductListItem } from "@/lib/api/catalog";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";
import { useAgentStore } from "@/store/agentStore";
import { ProductRail } from "@/components/home/ProductRail";

const ease = [0.16, 1, 0.3, 1] as const;
type Sort = "recent" | "price-asc" | "price-desc";

function stockNote(p: Product) {
  if (p.stock === 0) return { text: "Out of stock", tone: "text-subtle" };
  if (p.stock <= 5) return { text: `Only ${p.stock} left`, tone: "text-brand" };
  return { text: "In stock", tone: "text-subtle" };
}

function WishlistItem({
  product,
  onMove,
  onRemove,
}: {
  product: Product;
  onMove: () => void;
  onRemove: () => void;
}) {
  const note = stockNote(product);
  const soldOut = product.stock === 0;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
      transition={{ duration: 0.45, ease }}
      className="group flex flex-col"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-panel bg-surface-2">
        <Link href={`/products/${product.id}`} aria-label={product.name} className="absolute inset-0">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
            className={`object-cover transition-transform duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04] ${soldOut ? "opacity-60" : ""}`}
          />
        </Link>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${product.name} from wishlist`}
          className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-surface/85 text-ink backdrop-blur-md transition hover:bg-surface active:scale-[0.92]"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-3 flex flex-1 flex-col gap-1 px-1">
        <p className="text-[13px] text-subtle">{product.brand}</p>
        <h3 className="text-[15px] font-medium leading-snug text-ink">
          <Link href={`/products/${product.id}`} className="hover:underline">
            {product.name}
          </Link>
        </h3>
        <p className="text-[15px] text-ink">
          <span className="font-medium">{formatPrice(product.price)}</span>
          {product.compareAt && (
            <>
              <span className="ml-2 text-[13px] text-subtle line-through">{formatPrice(product.compareAt)}</span>
              <span className="ml-2 text-[12px] font-medium text-brand">On sale</span>
            </>
          )}
        </p>
        <p className={`text-[13px] ${note.tone}`}>{note.text}</p>
        <button
          type="button"
          onClick={onMove}
          disabled={soldOut}
          className="mt-3 flex h-10 items-center justify-center gap-2 rounded-full bg-ink text-[14px] font-medium text-bg transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-subtle"
        >
          <Bag size={16} />
          {soldOut ? "Sold out" : "Move to bag"}
        </button>
      </div>
    </motion.li>
  );
}

export function WishlistView() {
  const hydrated = useWishlistStore((s) => s.hydrated);
  const ids = useWishlistStore((s) => s.ids);
  const remove = useWishlistStore((s) => s.remove);
  const clear = useWishlistStore((s) => s.clear);
  const addToBag = useCartStore((s) => s.add);
  const openAgent = useAgentStore((s) => s.openPanel);

  const [sort, setSort] = useState<Sort>("recent");
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  const [catalogue, setCatalogue] = useState<Product[]>([]);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Load product details for the saved slugs; the list itself follows `ids`, newest first.
  const idsKey = ids.join(",");
  useEffect(() => {
    if (!idsKey) return;
    let alive = true;
    fetchProducts({ limit: 100 })
      .then((items) => alive && setCatalogue(items.map(mapProductListItem)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [idsKey]);
  const products = ids.map((id) => catalogue.find((p) => p.id === id)).filter((p): p is Product => Boolean(p));

  const notify = (text: string, undo?: () => void) => {
    setToast({ text, undo });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 4500);
  };

  const sorted =
    sort === "recent" ? products : [...products].sort((a, b) => (sort === "price-asc" ? a.price - b.price : b.price - a.price));
  const available = products.filter((p) => p.stock > 0);
  const total = available.reduce((s, p) => s + p.price, 0);

  const removeItem = (p: Product) => {
    const snapshot = useWishlistStore.getState().ids;
    remove(p.id);
    notify(`Removed ${p.name}`, () => useWishlistStore.getState().restore(snapshot));
  };

  const moveToBag = (p: Product) => {
    addToBag(p.id);
    remove(p.id);
    notify(`${p.name} moved to your bag`);
  };

  const addAll = () => {
    available.forEach((p) => addToBag(p.id));
    notify(`Added ${available.length} ${available.length === 1 ? "item" : "items"} to your bag`);
  };

  const clearAll = () => {
    const snapshot = ids;
    clear();
    notify("Wishlist cleared", () => useWishlistStore.getState().restore(snapshot));
  };

  return (
    <>
      <div className="mx-auto max-w-[1400px] px-4 pb-20 pt-24 md:px-8 md:pt-28">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between"
        >
          <div>
            <h1 className="text-4xl font-semibold tracking-[-0.04em] text-ink md:text-6xl">Wishlist</h1>
            <p className="mt-3 text-[16px] text-subtle">
              {hydrated && products.length > 0
                ? `${products.length} saved ${products.length === 1 ? "item" : "items"}, ${formatPrice(total)} for everything in stock.`
                : "Tap the heart on any product to save it for later."}
            </p>
          </div>

          {hydrated && products.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative">
                <span className="sr-only">Sort wishlist</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className="appearance-none rounded-full border border-line bg-surface py-2.5 pl-4 pr-10 text-[14px] font-medium text-ink outline-none focus:border-brand"
                >
                  <option value="recent">Recently saved</option>
                  <option value="price-asc">Price, low to high</option>
                  <option value="price-desc">Price, high to low</option>
                </select>
                <CaretDown size={14} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-subtle" />
              </label>
              <button
                type="button"
                onClick={clearAll}
                className="rounded-full px-4 py-2.5 text-[14px] font-medium text-subtle transition hover:bg-surface-2 hover:text-ink"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={addAll}
                disabled={available.length === 0}
                className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-[14px] font-medium text-brand-ink transition hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
              >
                <Bag size={16} />
                Add all to bag
              </button>
            </div>
          )}
        </motion.div>

        {!hydrated && (
          <div aria-busy="true" aria-label="Loading wishlist" className="mt-10 grid animate-pulse grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-3 md:gap-x-4 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                <div className="aspect-[4/5] rounded-panel bg-surface-2" />
                <div className="mt-3 h-3 w-1/3 rounded-full bg-surface-2" />
                <div className="mt-2 h-4 w-3/4 rounded-full bg-surface-2" />
              </div>
            ))}
          </div>
        )}

        {hydrated && products.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            className="mt-10 flex flex-col items-start gap-4 rounded-panel bg-surface px-6 py-14 md:px-12 md:py-20"
          >
            <span className="grid size-14 place-items-center rounded-full bg-brand-soft text-brand">
              <Heart size={26} />
            </span>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-ink md:text-3xl">Nothing saved yet</h2>
            <p className="max-w-[48ch] text-[16px] text-subtle">
              Save things you like and they&rsquo;ll wait here. We&rsquo;ll show you when they go on sale or run low.
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <Link
                href="/products"
                className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[15px] font-medium text-bg transition hover:opacity-90 active:scale-[0.98]"
              >
                Browse products
                <ArrowRight size={16} weight="bold" />
              </Link>
              <button
                type="button"
                onClick={() => openAgent("Help me find something I'd like")}
                className="inline-flex items-center gap-2 rounded-full border border-line px-6 py-3.5 text-[15px] font-medium text-ink transition hover:bg-surface-2"
              >
                <Sparkle size={16} weight="fill" className="text-brand" />
                Ask ZEK for ideas
              </button>
            </div>
          </motion.div>
        )}

        {hydrated && products.length > 0 && (
          <ul className="mt-10 grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-3 md:gap-x-4 xl:grid-cols-4">
            <AnimatePresence mode="popLayout" initial={false}>
              {sorted.map((p) => (
                <WishlistItem key={p.id} product={p} onMove={() => moveToBag(p)} onRemove={() => removeItem(p)} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {hydrated && products.length === 0 && <ProductRail title="Popular right now" />}

      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            className="fixed inset-x-4 bottom-6 z-40 mx-auto flex max-w-md items-center justify-between gap-4 rounded-full bg-ink py-2 pl-5 pr-2 text-[14px] text-bg shadow-soft"
          >
            <span className="flex min-w-0 items-center gap-2 truncate">
              {!toast.undo && <Check size={16} weight="bold" className="shrink-0" />}
              <span className="truncate">{toast.text}</span>
            </span>
            {toast.undo ? (
              <button
                type="button"
                onClick={() => {
                  toast.undo?.();
                  setToast(null);
                }}
                className="shrink-0 rounded-full bg-bg/15 px-4 py-2 font-medium text-bg transition hover:bg-bg/25"
              >
                Undo
              </button>
            ) : (
              <Link href="/cart" className="shrink-0 rounded-full bg-bg/15 px-4 py-2 font-medium text-bg transition hover:bg-bg/25">
                View bag
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

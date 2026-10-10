"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Bag, Truck } from "@phosphor-icons/react";
import { formatPrice, type Product } from "@/lib/catalog";
import { fetchProducts, mapProductListItem } from "@/lib/api/catalog";
import { computeTotals, FREE_SHIPPING_THRESHOLD, resolveLines } from "@/lib/pricing";
import { useCartStore, type CartLine } from "@/store/cartStore";
import { ProductRail } from "@/components/home/ProductRail";
import { CartLineItem } from "./CartLineItem";
import { CartSummary } from "./CartSummary";

const ease = [0.16, 1, 0.3, 1] as const;

function CartSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your bag" className="mt-10 grid animate-pulse grid-cols-1 gap-10 lg:grid-cols-12">
      <div className="flex flex-col gap-6 lg:col-span-7">
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-6">
            <div className="aspect-[4/5] w-28 rounded-[14px] bg-surface-2" />
            <div className="flex flex-1 flex-col gap-3 pt-1">
              <div className="h-3 w-1/4 rounded-full bg-surface-2" />
              <div className="h-4 w-2/3 rounded-full bg-surface-2" />
            </div>
          </div>
        ))}
      </div>
      <div className="h-80 rounded-panel bg-surface-2 lg:col-span-5" />
    </div>
  );
}

export function CartView() {
  const hydrated = useCartStore((s) => s.hydrated);
  const rawLines = useCartStore((s) => s.lines);
  const promo = useCartStore((s) => s.promo);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const remove = useCartStore((s) => s.remove);
  const restore = useCartStore((s) => s.restore);
  const refresh = useCartStore((s) => s.refresh);

  const [products, setProducts] = useState<Product[]>([]);
  const [removed, setRemoved] = useState<{ line: CartLine; index: number; name: string } | null>(null);
  const undoTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    fetchProducts({ limit: 100 })
      .then((items) => setProducts(items.map(mapProductListItem)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  useEffect(() => () => window.clearTimeout(undoTimer.current), []);

  const lines = resolveLines(rawLines);
  const totals = computeTotals(lines, promo);
  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);
  const progress = Math.min(1, totals.subtotal / FREE_SHIPPING_THRESHOLD);

  const handleRemove = (line: CartLine, name: string) => {
    const index = rawLines.findIndex((l) => l.key === line.key);
    remove(line.key);
    setRemoved({ line, index, name });
    window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setRemoved(null), 5000);
  };

  const handleUndo = () => {
    if (!removed) return;
    restore(removed.line, removed.index);
    setRemoved(null);
    window.clearTimeout(undoTimer.current);
  };

  const empty = hydrated && lines.length === 0;
  const newArrivals = products.slice(0, 6);

  return (
    <>
      <div className="mx-auto max-w-[1400px] px-4 pb-28 pt-24 md:px-8 md:pt-28 lg:pb-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="flex items-baseline gap-4"
        >
          <h1 className="text-4xl font-semibold tracking-[-0.04em] text-ink md:text-6xl">Your bag</h1>
          {hydrated && itemCount > 0 && (
            <p className="text-[16px] text-subtle">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </p>
          )}
        </motion.div>

        {!hydrated && <CartSkeleton />}

        {empty && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            className="mt-10 flex flex-col items-start gap-4 rounded-panel bg-surface px-6 py-14 md:px-12 md:py-20"
          >
            <span className="grid size-14 place-items-center rounded-full bg-brand-soft text-brand">
              <Bag size={26} />
            </span>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-ink md:text-3xl">
              Your bag is empty
            </h2>
            <p className="max-w-[46ch] text-[16px] text-subtle">
              Items you add will show up here. Start with something new or browse a collection.
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <Link
                href="/products"
                className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[15px] font-medium text-bg transition hover:opacity-90 active:scale-[0.98]"
              >
                Continue shopping
                <ArrowRight size={16} weight="bold" />
              </Link>
              <Link
                href="/collections"
                className="inline-flex items-center rounded-full border border-line px-6 py-3.5 text-[15px] font-medium text-ink transition hover:bg-surface-2"
              >
                View collections
              </Link>
            </div>
          </motion.div>
        )}

        {hydrated && lines.length > 0 && (
          <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-14">
            <section aria-label="Items in your bag" className="lg:col-span-7">
              <div className="rounded-panel bg-surface p-4 md:p-5">
                <p className="flex items-center gap-2 text-[14px] text-ink">
                  <Truck size={18} className="shrink-0 text-brand" />
                  {totals.remainingForFree > 0 ? (
                    <>
                      Add <span className="font-semibold">{formatPrice(totals.remainingForFree)}</span> more for free shipping
                    </>
                  ) : (
                    <span className="font-medium">You have free shipping</span>
                  )}
                </p>
                <div
                  className="mt-3 h-1 overflow-hidden rounded-full bg-line"
                  role="progressbar"
                  aria-label="Progress to free shipping"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress * 100)}
                >
                  <motion.div
                    className="h-full origin-left rounded-full bg-brand"
                    initial={false}
                    animate={{ scaleX: progress }}
                    transition={{ duration: 0.6, ease }}
                  />
                </div>
              </div>

              <ul className="mt-2 divide-y divide-line">
                <AnimatePresence initial={false} mode="popLayout">
                  {lines.map((line) => (
                    <CartLineItem
                      key={line.key}
                      line={line}
                      onQuantity={(q) => setQuantity(line.key, q)}
                      onRemove={() => handleRemove(line, line.product.name)}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            </section>

            <aside className="lg:col-span-5">
              <div className="lg:sticky lg:top-28">
                <CartSummary totals={totals} />
              </div>
            </aside>
          </div>
        )}
      </div>

      {empty && <ProductRail title="You might like" products={newArrivals} />}

      {hydrated && lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 px-4 py-3 backdrop-blur-xl lg:hidden">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-[13px] text-subtle">Total</p>
              <p className="text-[17px] font-semibold text-ink">{formatPrice(totals.total)}</p>
            </div>
            <Link
              href="/checkout"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-6 text-[14px] font-medium text-brand-ink active:scale-[0.98]"
            >
              Checkout
              <ArrowRight size={14} weight="bold" />
            </Link>
          </div>
        </div>
      )}

      <AnimatePresence>
        {removed && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-md items-center justify-between gap-4 rounded-full bg-ink py-2 pl-5 pr-2 text-[14px] text-bg shadow-soft lg:bottom-8"
          >
            <span className="truncate">Removed {removed.name}</span>
            <button
              type="button"
              onClick={handleUndo}
              className="shrink-0 rounded-full bg-bg/15 px-4 py-2 font-medium text-bg transition hover:bg-bg/25"
            >
              Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

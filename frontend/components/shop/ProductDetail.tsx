"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import {
  ArrowsCounterClockwise,
  Check,
  Heart,
  Minus,
  Plus,
  Star,
  Truck,
} from "@phosphor-icons/react";
import { formatPrice, type Product } from "@/lib/catalog";
import { useCartStore } from "@/store/cartStore";
import { useIsSaved, useWishlistStore } from "@/store/wishlistStore";
import { ProductGallery } from "./ProductGallery";

const ease = [0.16, 1, 0.3, 1] as const;

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={14}
          weight={rating >= i - 0.25 ? "fill" : rating >= i - 0.75 ? "duotone" : "regular"}
          className="text-ink"
        />
      ))}
    </span>
  );
}

function Accordion({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-4 text-left text-[15px] font-medium text-ink"
      >
        {title}
        <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.3, ease }}>
          <Plus size={16} />
        </motion.span>
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="pb-5 text-[15px] leading-relaxed text-subtle">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function ProductDetail({ product }: { product: Product }) {
  const add = useCartStore((s) => s.add);
  const [color, setColor] = useState(product.colors?.[0]?.name ?? null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const saved = useIsSaved(product.id);
  const toggleSaved = useWishlistStore((s) => s.toggle);
  const buyRef = useRef<HTMLDivElement>(null);
  const buyInView = useInView(buyRef, { margin: "-64px 0px 0px 0px" });

  const maxQty = Math.min(product.stock, 10);
  const savings = product.compareAt ? product.compareAt - product.price : 0;

  const selectedVariant = product.colors?.length
    ? undefined
    : undefined;

  const handleAdd = () => {
    add(product.id, quantity, color ?? undefined, selectedVariant, {
      name: product.name,
      brand: product.brand,
      image: product.image,
      price: product.price,
      compareAt: product.compareAt,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  const addLabel = (
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
            <Check size={18} weight="bold" /> Added to bag
          </>
        ) : (
          "Add to bag"
        )}
      </motion.span>
    </AnimatePresence>
  );

  return (
    <>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-14">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease }}
          className="lg:col-span-7"
        >
          <ProductGallery name={product.name} images={product.gallery} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease }}
          className="lg:col-span-5"
        >
          <div className="lg:sticky lg:top-28">
            <p className="text-[14px] text-subtle">{product.brand}</p>
            <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-[-0.035em] text-ink md:text-4xl">
              {product.name}
            </h1>

            <a href="#details" className="mt-3 flex w-fit items-center gap-2 text-[14px] text-subtle hover:text-ink">
              <Stars rating={product.rating} />
              <span className="font-medium text-ink">{product.rating.toFixed(1)}</span>
              <span>{product.reviews} reviews</span>
            </a>

            <div className="mt-6 flex flex-wrap items-baseline gap-3">
              <p className="text-3xl font-semibold tracking-[-0.03em] text-ink">
                {formatPrice(product.price)}
              </p>
              {product.compareAt && (
                <>
                  <p className="text-[17px] text-subtle line-through">
                    {formatPrice(product.compareAt)}
                  </p>
                  <p className="rounded-full bg-brand-soft px-2.5 py-1 text-[13px] font-medium text-brand">
                    Save {formatPrice(savings)}
                  </p>
                </>
              )}
            </div>

            <p className="mt-5 max-w-[52ch] text-[16px] leading-relaxed text-subtle">
              {product.description}
            </p>

            {product.colors && (
              <fieldset className="mt-8">
                <legend className="text-[14px] text-subtle">
                  Color: <span className="font-medium text-ink">{color}</span>
                </legend>
                <div role="radiogroup" aria-label="Color" className="mt-3 flex gap-3">
                  {product.colors.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      role="radio"
                      aria-checked={color === c.name}
                      aria-label={c.name}
                      onClick={() => setColor(c.name)}
                      className={`size-9 rounded-full border border-line transition ${
                        color === c.name ? "ring-2 ring-ink ring-offset-2 ring-offset-bg" : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </fieldset>
            )}

            <div ref={buyRef} className="mt-8 flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-full border border-line bg-surface">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="grid size-12 place-items-center rounded-full text-ink transition hover:bg-surface-2 disabled:opacity-40"
                >
                  <Minus size={16} />
                </button>
                <span aria-live="polite" className="w-8 text-center text-[15px] font-medium tabular-nums text-ink">
                  {quantity}
                </span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  disabled={quantity >= maxQty}
                  onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                  className="grid size-12 place-items-center rounded-full text-ink transition hover:bg-surface-2 disabled:opacity-40"
                >
                  <Plus size={16} />
                </button>
              </div>

              <motion.button
                type="button"
                onClick={handleAdd}
                whileTap={{ scale: 0.98 }}
                className="flex h-12 min-w-0 flex-1 items-center justify-center rounded-full bg-brand px-6 text-[15px] font-medium text-brand-ink transition hover:opacity-90"
              >
                {addLabel}
              </motion.button>

              <button
                type="button"
                aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
                aria-pressed={saved}
                onClick={() => toggleSaved(product.id)}
                className="grid size-12 place-items-center rounded-full border border-line text-ink transition hover:bg-surface-2 active:scale-[0.95]"
              >
                <Heart size={20} weight={saved ? "fill" : "regular"} className={saved ? "text-brand" : ""} />
              </button>
            </div>

            <p className={`mt-4 text-[14px] ${product.stock <= 5 ? "font-medium text-brand" : "text-subtle"}`}>
              {product.stock <= 5
                ? `Only ${product.stock} left in stock`
                : "In stock, ships in 1 to 2 days"}
            </p>

            <ul className="mt-8 flex flex-col gap-3 rounded-panel bg-surface p-5">
              <li className="flex items-center gap-3 text-[14px] text-ink">
                <Truck size={20} className="shrink-0 text-brand" />
                {product.price >= 50
                  ? "Free shipping on this item"
                  : "Free shipping on orders over $50"}
              </li>
              <li className="flex items-center gap-3 text-[14px] text-ink">
                <ArrowsCounterClockwise size={20} className="shrink-0 text-brand" />
                Free returns within 30 days
              </li>
            </ul>

            <div id="details" className="mt-8 border-t border-line">
              <Accordion title="Details" defaultOpen>
                <ul className="flex list-disc flex-col gap-1.5 pl-5">
                  {product.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </Accordion>
              <Accordion title="Shipping and returns">
                Orders ship within 1 to 2 business days and usually arrive in 2 to 4 days.
                Shipping is free on orders over $50. Not right? Return it within 30 days for a full refund.
              </Accordion>
              {product.category && (
                <Accordion title="More in this category">
                  <Link
                    href={`/products?category=${product.category}`}
                    className="font-medium text-ink underline-offset-4 hover:underline"
                  >
                    Shop all {product.category}
                  </Link>
                </Accordion>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Mobile: keep the buy button reachable once the main one scrolls away. */}
      <AnimatePresence>
        {!buyInView && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 px-4 py-3 backdrop-blur-xl lg:hidden"
          >
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-ink">{product.name}</p>
                <p className="text-[14px] text-subtle">{formatPrice(product.price)}</p>
              </div>
              <motion.button
                type="button"
                onClick={handleAdd}
                whileTap={{ scale: 0.97 }}
                className="flex h-11 shrink-0 items-center justify-center rounded-full bg-brand px-5 text-[14px] font-medium text-brand-ink"
              >
                {addLabel}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

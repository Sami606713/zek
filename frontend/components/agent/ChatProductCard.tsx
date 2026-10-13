"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Minus, Plus, Star, WarningCircle } from "@phosphor-icons/react";
import { api } from "@/lib/api/client";
import { formatPrice } from "@/lib/catalog";
import { useCartStore } from "@/store/cartStore";
import { useAgentStore } from "@/store/agentStore";

// Product as it appears inside an agent tool result (GET /products list items).
export type ChatProduct = {
  id?: string;
  slug: string;
  name: string;
  brand?: string | null;
  price: string | number;
  compare_at_price?: string | number | null;
  image?: string | { url?: string } | null;
  image_url?: string | null;
  rating_avg?: number;
  review_count?: number;
  in_stock?: boolean;
  is_low_stock?: boolean;
  total_stock?: number;
  description?: string | null;
};

// Exact fields of GET /api/v1/products/{slug} that the card uses.
type Variant = {
  id: string;
  color_name: string | null;
  color_hex: string | null;
  size: string | null;
  effective_price: string;
  stock_qty: number;
  in_stock: boolean;
  is_active: boolean;
};
type Detail = {
  slug: string;
  brand?: string | null;
  compare_at_price?: string | null;
  rating_avg?: number;
  review_count?: number;
  description: string | null;
  details: string[];
  images: { url: string }[];
  variants: Variant[];
};

const MAX_QTY = 10;
const num = (v: string | number | null | undefined) => (v == null || v === "" ? undefined : Number(v));

// One request per product per page view, shared by every card that shows it.
const detailCache = new Map<string, Promise<Detail>>();
function loadDetail(slug: string) {
  if (!detailCache.has(slug)) {
    const p = api.get<Detail>(`/products/${slug}`, { auth: false });
    p.catch(() => detailCache.delete(slug));
    detailCache.set(slug, p);
  }
  return detailCache.get(slug)!;
}

const imageOf = (p: ChatProduct) =>
  (typeof p.image === "string" ? p.image : p.image?.url) || p.image_url || "";

export function ChatProductCard({ product }: { product: ChatProduct }) {
  const add = useCartStore((s) => s.add);
  const closePanel = useAgentStore((s) => s.closePanel);

  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [status, setStatus] = useState<"idle" | "adding" | "added" | "error">("idle");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let alive = true;
    loadDetail(product.slug)
      .then((d) => {
        if (!alive) return;
        setDetail(d);
        const first = d.variants.find((v) => v.is_active && v.in_stock) ?? d.variants[0];
        setVariantId(first?.id ?? null);
      })
      .catch(() => alive && setLoadFailed(true));
    return () => {
      alive = false;
    };
  }, [product.slug]);

  const variants = (detail?.variants ?? []).filter((v) => v.is_active);
  const variant = variants.find((v) => v.id === variantId) ?? null;
  const colors = [...new Map(variants.filter((v) => v.color_name).map((v) => [v.color_name!, v])).values()];
  const sizes = [...new Set(variants.map((v) => v.size).filter(Boolean))] as string[];

  const price = num(variant?.effective_price) ?? num(product.price) ?? 0;
  const compareAt = num(product.compare_at_price) ?? num(detail?.compare_at_price);
  const brand = product.brand ?? detail?.brand ?? null;
  const rating = product.rating_avg ?? detail?.rating_avg;
  const reviews = product.review_count ?? detail?.review_count;
  const stock = variant ? variant.stock_qty : (product.total_stock ?? 0);
  const soldOut = detail ? !variant || !variant.in_stock : product.in_stock === false;
  const maxQty = Math.max(1, Math.min(MAX_QTY, stock || MAX_QTY));
  const image = imageOf(product) || detail?.images[0]?.url || "";
  const description = detail?.description || product.description || "";

  // Pick the variant matching a color or size, keeping the other dimension when possible.
  const choose = (color: string | null, size: string | null) => {
    const match =
      variants.find((v) => v.color_name === color && v.size === size && v.in_stock) ??
      variants.find((v) => (color ? v.color_name === color : v.size === size) && v.in_stock) ??
      variants.find((v) => (color ? v.color_name === color : v.size === size));
    if (match) {
      setVariantId(match.id);
      setQty((q) => Math.min(q, Math.max(1, Math.min(MAX_QTY, match.stock_qty))));
    }
  };

  const addToBag = async () => {
    if (!variant || soldOut) return;
    setStatus("adding");
    try {
      await add(product.slug, qty, variant.color_name ?? variant.size ?? undefined, variant.id, {
        name: product.name,
        brand: brand ?? "",
        image,
        price,
        compareAt,
      });
      setStatus("added");
      window.setTimeout(() => setStatus("idle"), 2400);
    } catch {
      setStatus("error");
    }
  };

  const closeOnMobile = () => {
    if (window.matchMedia("(max-width: 767px)").matches) closePanel();
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden rounded-2xl border border-line bg-surface"
    >
      <div className="flex gap-3 p-3">
        <Link
          href={`/products/${product.slug}`}
          onClick={closeOnMobile}
          className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-surface-2"
        >
          {image && (
            <Image src={image} alt={product.name} fill sizes="96px" className="object-cover" unoptimized={!image.includes("picsum.photos")} />
          )}
          {compareAt && compareAt > price && (
            <span className="absolute left-1.5 top-1.5 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-brand-ink">Sale</span>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          {brand && <p className="text-[12px] text-subtle">{brand}</p>}
          <Link href={`/products/${product.slug}`} onClick={closeOnMobile} className="line-clamp-2 text-[14px] font-semibold leading-snug text-ink hover:underline">
            {product.name}
          </Link>
          {!!reviews && (
            <p className="mt-1 flex items-center gap-1 text-[12px] text-subtle">
              <Star size={12} weight="fill" className="text-ink" />
              <span className="font-medium text-ink">{rating?.toFixed(1)}</span>({reviews})
            </p>
          )}
          <p className="mt-1.5 flex items-baseline gap-2">
            <span className="text-[16px] font-semibold tabular-nums text-ink">{formatPrice(price)}</span>
            {compareAt && compareAt > price && (
              <span className="text-[12px] tabular-nums text-subtle line-through">{formatPrice(compareAt)}</span>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-line px-3 pb-3 pt-3">
        {description ? (
          <div className="text-[13px] leading-relaxed text-subtle">
            <p className={expanded ? "" : "line-clamp-2"}>{description}</p>
            {description.length > 110 && (
              <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-0.5 text-[12px] font-medium text-ink hover:underline">
                {expanded ? "Show less" : "Read more"}
              </button>
            )}
          </div>
        ) : (
          !detail && !loadFailed && <div className="h-8 animate-pulse rounded-md bg-surface-2" aria-hidden />
        )}

        {colors.length > 0 && (
          <div>
            <p className="mb-1.5 text-[12px] text-subtle">
              Color: <span className="font-medium text-ink">{variant?.color_name}</span>
            </p>
            <div role="radiogroup" aria-label={`${product.name} color`} className="flex flex-wrap gap-2">
              {colors.map((v) => {
                const selected = variant?.color_name === v.color_name;
                const available = variants.some((x) => x.color_name === v.color_name && x.in_stock);
                return (
                  <button
                    key={v.color_name}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${v.color_name}${available ? "" : ", sold out"}`}
                    onClick={() => choose(v.color_name, variant?.size ?? null)}
                    className={`relative size-7 rounded-full border border-line transition ${selected ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : "hover:scale-105"} ${available ? "" : "opacity-40"}`}
                    style={{ backgroundColor: v.color_hex ?? "#b6bac2" }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {sizes.length > 0 && (
          <div>
            <p className="mb-1.5 text-[12px] text-subtle">Size</p>
            <div role="radiogroup" aria-label={`${product.name} size`} className="flex flex-wrap gap-1.5">
              {sizes.map((size) => {
                const selected = variant?.size === size;
                const available = variants.some((x) => x.size === size && (!variant?.color_name || x.color_name === variant.color_name) && x.in_stock);
                return (
                  <button
                    key={size}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => choose(variant?.color_name ?? null, size)}
                    className={`min-w-10 rounded-full border px-3 py-1 text-[12px] font-medium transition ${
                      selected ? "border-ink bg-ink text-bg" : "border-line text-ink hover:bg-surface-2"
                    } ${available ? "" : "line-through opacity-50"}`}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <p className={`text-[12px] ${soldOut ? "text-danger" : stock > 0 && stock <= 5 ? "font-medium text-brand" : "text-subtle"}`}>
          {loadFailed ? "Couldn't load options. Open the product page to buy." : soldOut ? "Sold out" : stock > 0 && stock <= 5 ? `Only ${stock} left` : "In stock"}
        </p>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border border-line bg-bg">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={qty <= 1 || soldOut}
              aria-label={`Decrease quantity of ${product.name}`}
              className="grid size-9 place-items-center rounded-full text-ink transition hover:bg-surface-2 disabled:opacity-30"
            >
              <Minus size={13} weight="bold" />
            </button>
            <span aria-live="polite" className="w-7 text-center text-[14px] font-semibold tabular-nums text-ink">
              {qty}
            </span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
              disabled={qty >= maxQty || soldOut}
              aria-label={`Increase quantity of ${product.name}`}
              className="grid size-9 place-items-center rounded-full text-ink transition hover:bg-surface-2 disabled:opacity-30"
            >
              <Plus size={13} weight="bold" />
            </button>
          </div>

          <button
            type="button"
            onClick={addToBag}
            disabled={!variant || soldOut || status === "adding"}
            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-brand text-[13px] font-semibold text-brand-ink transition hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={status}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="inline-flex items-center gap-1.5"
              >
                {status === "added" ? (
                  <>
                    <Check size={14} weight="bold" /> Added {qty > 1 ? `${qty} ` : ""}to bag
                  </>
                ) : status === "adding" ? (
                  "Adding…"
                ) : soldOut ? (
                  "Sold out"
                ) : (
                  <>
                    <Plus size={14} weight="bold" /> Add to bag · {formatPrice(price * qty)}
                  </>
                )}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>

        <AnimatePresence>
          {status === "added" && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <Link href="/cart" onClick={closePanel} className="inline-flex items-center gap-1 text-[12px] font-medium text-brand hover:underline">
                View bag and check out <ArrowRight size={12} weight="bold" />
              </Link>
            </motion.div>
          )}
          {status === "error" && (
            <motion.p role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1.5 text-[12px] text-danger">
              <WarningCircle size={14} /> Couldn&rsquo;t add it. Please try again.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}

export function ChatProductList({ products }: { products: ChatProduct[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? products : products.slice(0, 3);
  return (
    <div className="flex flex-col gap-2.5">
      {visible.map((p) => (
        <ChatProductCard key={p.slug} product={p} />
      ))}
      {products.length > 3 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="self-start rounded-full border border-line px-4 py-1.5 text-[13px] font-medium text-ink transition hover:bg-surface-2"
        >
          {showAll ? "Show fewer" : `Show ${products.length - 3} more`}
        </button>
      )}
    </div>
  );
}

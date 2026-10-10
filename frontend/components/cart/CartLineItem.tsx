"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { Minus, Plus, Trash } from "@phosphor-icons/react";
import { formatPrice } from "@/lib/catalog";
import type { ResolvedLine } from "@/lib/pricing";

type CartLineItemProps = {
  line: ResolvedLine;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
};

export function CartLineItem({ line, onQuantity, onRemove }: CartLineItemProps) {
  const { product, quantity } = line;
  if (!product) return null;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -24, transition: { duration: 0.25 } }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="flex gap-4 py-6 md:gap-6"
    >
      <Link
        href={`/products/${line.id}`}
        className="relative aspect-[4/5] w-24 shrink-0 overflow-hidden rounded-[14px] bg-surface-2 md:w-28"
      >
        <Image src={product.image} alt={product.name} fill sizes="112px" className="object-cover" />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {product.brand && <p className="text-[13px] text-subtle">{product.brand}</p>}
            <h3 className="mt-0.5 text-[15px] font-medium leading-snug text-ink md:text-[16px]">
              <Link href={`/products/${line.id}`} className="hover:underline">
                {product.name}
              </Link>
            </h3>
            {line.color && <p className="mt-1 text-[13px] text-subtle">Color: {line.color}</p>}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[15px] font-medium text-ink md:text-[16px]">
              {formatPrice(line.lineTotal)}
            </p>
            {quantity > 1 && (
              <p className="text-[13px] text-subtle">{formatPrice(product.price)} each</p>
            )}
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between gap-4 pt-4">
          <div className="flex items-center rounded-full border border-line bg-surface">
            <button
              type="button"
              aria-label={`Decrease quantity of ${product.name}`}
              disabled={quantity <= 1}
              onClick={() => onQuantity(quantity - 1)}
              className="grid size-9 place-items-center rounded-full text-ink transition hover:bg-surface-2 disabled:opacity-40"
            >
              <Minus size={14} />
            </button>
            <span
              aria-live="polite"
              aria-label={`Quantity ${quantity}`}
              className="w-7 text-center text-[14px] font-medium tabular-nums text-ink"
            >
              {quantity}
            </span>
            <button
              type="button"
              aria-label={`Increase quantity of ${product.name}`}
              onClick={() => onQuantity(quantity + 1)}
              className="grid size-9 place-items-center rounded-full text-ink transition hover:bg-surface-2"
            >
              <Plus size={14} />
            </button>
          </div>

          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium text-subtle transition hover:bg-surface-2 hover:text-ink"
          >
            <Trash size={16} />
            Remove
          </button>
        </div>
      </div>
    </motion.li>
  );
}

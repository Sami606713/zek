"use client";

import Image from "next/image";
import { useState } from "react";
import { motion } from "motion/react";
import { CaretDown, Tag } from "@phosphor-icons/react";
import { formatPrice } from "@/lib/catalog";
import type { computeTotals, ResolvedLine } from "@/lib/pricing";

type Totals = ReturnType<typeof computeTotals>;

type CheckoutSummaryProps = {
  lines: ResolvedLine[];
  totals: Totals;
  promo: string | null;
};

function SummaryBody({ lines, totals, promo }: CheckoutSummaryProps) {
  return (
    <>
      <ul className="flex flex-col gap-4">
        {lines.map((line) => (
          <li key={line.key} className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="relative size-16 overflow-hidden rounded-[12px] bg-surface-2">
                <Image src={line.product.image} alt="" fill sizes="64px" className="object-cover" />
              </div>
              <span className="absolute -right-2 -top-2 grid min-w-5 place-items-center rounded-full bg-ink px-1.5 text-[11px] font-semibold leading-5 text-bg">
                {line.quantity}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-ink">{line.product.name}</p>
              <p className="text-[13px] text-subtle">
                {line.color ? `${line.color}` : line.product.brand}
              </p>
            </div>
            <p className="shrink-0 text-[14px] font-medium text-ink">{formatPrice(line.lineTotal)}</p>
          </li>
        ))}
      </ul>

      <dl className="mt-6 flex flex-col gap-3 border-t border-line pt-6 text-[15px]">
        <div className="flex justify-between gap-4">
          <dt className="text-subtle">Subtotal</dt>
          <dd className="text-ink">{formatPrice(totals.subtotal)}</dd>
        </div>
        {promo && totals.discount > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="flex items-center gap-2 text-subtle">
              Discount
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[12px] font-medium text-brand">
                <Tag size={12} weight="bold" />
                {promo}
              </span>
            </dt>
            <dd className="font-medium text-brand">-{formatPrice(totals.discount)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-subtle">Shipping</dt>
          <dd className="text-ink">{totals.shipping === 0 ? "Free" : formatPrice(totals.shipping)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-subtle">Estimated tax</dt>
          <dd className="text-ink">{formatPrice(totals.tax)}</dd>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-line pt-4">
          <dt className="text-[16px] font-medium text-ink">Total</dt>
          <dd className="text-2xl font-semibold tracking-[-0.02em] text-ink">
            <span className="mr-1.5 text-[13px] font-normal text-subtle">USD</span>
            {formatPrice(totals.total)}
          </dd>
        </div>
      </dl>
    </>
  );
}

export function CheckoutSummary(props: CheckoutSummaryProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile: collapsed by default so the form comes first. */}
      <div className="rounded-panel bg-surface lg:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-summary"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-[15px]"
        >
          <span className="flex items-center gap-2 font-medium text-brand">
            {open ? "Hide" : "Show"} order summary
            <motion.span animate={{ rotate: open ? 180 : 0 }} className="grid">
              <CaretDown size={14} weight="bold" />
            </motion.span>
          </span>
          <span className="font-semibold text-ink">{formatPrice(props.totals.total)}</span>
        </button>
        <div
          id="mobile-summary"
          className={`grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="border-t border-line px-5 pb-5 pt-5">
              <SummaryBody {...props} />
            </div>
          </div>
        </div>
      </div>

      <div className="hidden rounded-panel bg-surface p-8 lg:block">
        <h2 className="mb-6 text-xl font-semibold tracking-[-0.02em] text-ink">Order summary</h2>
        <SummaryBody {...props} />
      </div>
    </>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, LockKey, Tag, X } from "@phosphor-icons/react";
import { formatPrice } from "@/lib/catalog";
import { promoCodes, type computeTotals } from "@/lib/pricing";
import { useCartStore } from "@/store/cartStore";

type Totals = ReturnType<typeof computeTotals>;

function Row({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-[15px]">
      <dt className="text-subtle">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

export function CartSummary({ totals }: { totals: Totals }) {
  const promo = useCartStore((s) => s.promo);
  const setPromo = useCartStore((s) => s.setPromo);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const applyCode = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      setError("Enter a promo code.");
      return;
    }
    if (!promoCodes[normalized]) {
      setError(`"${normalized}" is not a valid code. Try ZEK10.`);
      return;
    }
    setPromo(normalized);
    setCode("");
    setError(null);
  };

  return (
    <div className="rounded-panel bg-surface p-6 md:p-8">
      <h2 className="text-xl font-semibold tracking-[-0.02em] text-ink">Order summary</h2>

      <dl className="mt-6 flex flex-col gap-3">
        <Row label="Subtotal" value={formatPrice(totals.subtotal)} />
        {promo && totals.discount > 0 && (
          <div className="flex items-center justify-between gap-4 text-[15px]">
            <dt className="flex items-center gap-2 text-subtle">
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[12px] font-medium text-brand">
                <Tag size={12} weight="bold" />
                {promo}
              </span>
              <button
                type="button"
                aria-label="Remove promo code"
                onClick={() => setPromo(null)}
                className="grid size-6 place-items-center rounded-full text-subtle hover:bg-surface-2 hover:text-ink"
              >
                <X size={12} weight="bold" />
              </button>
            </dt>
            <dd className="font-medium text-brand">-{formatPrice(totals.discount)}</dd>
          </div>
        )}
        <Row
          label="Shipping"
          value={totals.shipping === 0 ? "Free" : formatPrice(totals.shipping)}
        />
        <Row label="Estimated tax" value={formatPrice(totals.tax)} />
        <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-line pt-4">
          <dt className="text-[16px] font-medium text-ink">Total</dt>
          <dd className="text-2xl font-semibold tracking-[-0.02em] text-ink">
            {formatPrice(totals.total)}
          </dd>
        </div>
        {totals.savings + totals.discount > 0 && (
          <p className="text-right text-[13px] font-medium text-brand">
            You&apos;re saving {formatPrice(totals.savings + totals.discount)} on this order
          </p>
        )}
      </dl>

      {!promo && (
        <form onSubmit={applyCode} noValidate className="mt-6 flex flex-col gap-2">
          <label htmlFor="promo-code" className="text-[14px] font-medium text-ink">
            Promo code
          </label>
          <div className="flex gap-2">
            <input
              id="promo-code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Enter code"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "promo-error" : undefined}
              autoComplete="off"
              className={`min-w-0 flex-1 rounded-full border bg-bg px-4 py-2.5 text-[15px] uppercase text-ink outline-none transition placeholder:normal-case placeholder:text-subtle focus:border-brand ${
                error ? "border-[#d93a3a]" : "border-line"
              }`}
            />
            <button
              type="submit"
              className="shrink-0 rounded-full border border-line px-5 text-[14px] font-medium text-ink transition hover:bg-surface-2 active:scale-[0.98]"
            >
              Apply
            </button>
          </div>
          <AnimatePresence initial={false}>
            {error && (
              <motion.p
                id="promo-error"
                role="alert"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-[13px] text-[#d93a3a] dark:text-[#ff8a8a]"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </form>
      )}

      <Link
        href="/checkout"
        className="group mt-8 flex h-13 w-full items-center justify-center gap-2 rounded-full bg-brand py-3.5 text-[15px] font-medium text-brand-ink transition hover:opacity-90 active:scale-[0.98]"
      >
        Checkout
        <ArrowRight
          size={16}
          weight="bold"
          className="transition-transform duration-300 group-hover:translate-x-1"
        />
      </Link>

      <p className="mt-4 flex items-center justify-center gap-2 text-[13px] text-subtle">
        <LockKey size={14} />
        Secure checkout, payments by Stripe
      </p>
    </div>
  );
}

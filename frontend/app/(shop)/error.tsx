"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { useEffect } from "react";
import { ArrowClockwise, WarningCircle } from "@phosphor-icons/react";

// A page in the shop crashed. The navbar, footer and bag still work around it.
export default function ShopError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-[640px] flex-col items-start px-4 pb-24 pt-28 md:px-8 md:pt-36">
      <span className="grid size-12 place-items-center rounded-full bg-[#d93a3a]/10 text-[#c62f2f] dark:text-[#ff8a8a]">
        <WarningCircle size={24} weight="duotone" />
      </span>
      <h1 className="mt-6 text-4xl font-semibold tracking-[-0.04em] text-ink md:text-5xl">Something went wrong</h1>
      <p className="mt-4 max-w-[48ch] text-[16px] text-subtle">
        This page didn&apos;t load properly. Your bag and orders are safe. Try again, or head back to the shop.
      </p>
      {error.digest && <p className="mt-3 font-mono text-[12px] text-subtle">Reference: {error.digest}</p>}
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[15px] font-medium text-bg transition hover:opacity-90"
        >
          <ArrowClockwise size={16} /> Try again
        </button>
        <Link href="/products" className="rounded-full border border-line px-6 py-3.5 text-[15px] font-medium text-ink transition hover:bg-surface-2">
          Back to the shop
        </Link>
      </div>
    </div>
  );
}

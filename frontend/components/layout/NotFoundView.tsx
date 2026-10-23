import Link from "next/link";

/** Shared body of the 404 pages (inside the shop, and for unknown addresses). */
export function NotFoundView() {
  return (
    <div className="mx-auto flex max-w-[640px] flex-col items-start px-4 pb-24 pt-28 md:px-8 md:pt-36">
      <p className="font-mono text-[13px] font-medium text-brand">404</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-ink md:text-5xl">We couldn&apos;t find that page</h1>
      <p className="mt-4 max-w-[48ch] text-[16px] text-subtle">
        The link may be old, or the product is no longer in the store. Try the shop, or describe what you&apos;re after and ZEK
        will find it.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/products" className="rounded-full bg-ink px-6 py-3.5 text-[15px] font-medium text-bg transition hover:opacity-90">
          Browse the shop
        </Link>
        <Link href="/" className="rounded-full border border-line px-6 py-3.5 text-[15px] font-medium text-ink transition hover:bg-surface-2">
          Go home
        </Link>
      </div>
    </div>
  );
}

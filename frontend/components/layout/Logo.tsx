import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="ZEK home"
      className={`inline-flex items-center gap-2 font-semibold tracking-[-0.06em] text-ink ${className}`}
    >
      <span
        aria-hidden
        className="grid size-7 place-items-center rounded-[8px] bg-ink text-[13px] font-bold tracking-tight text-bg"
      >
        Z
      </span>
      <span className="text-[22px] leading-none">ZEK</span>
    </Link>
  );
}

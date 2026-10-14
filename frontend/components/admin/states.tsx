"use client";

import Link from "next/link";
import { ArrowClockwise, MagnifyingGlass, WarningCircle } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { errorMessage } from "@/lib/admin/useAdminQuery";

/** Placeholder rows while a table loads for the first time. */
export function TableSkeleton({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line" aria-busy="true" aria-label="Loading">
      <div className="flex gap-4 border-b border-line px-4 py-3">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-line px-4 py-3.5 last:border-0">
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className={c === 0 ? "h-4 flex-[1.6]" : "h-4 flex-1"} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Placeholder for a detail page or a grid of cards. */
export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: Icon;
  action?: React.ReactNode;
};

/** Nothing to show: no data yet, or no matches for the filters. */
export function EmptyState({ title, description, icon: IconCmp = MagnifyingGlass, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line px-6 py-14 text-center">
      <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
        <IconCmp size={22} weight="duotone" />
      </span>
      <p className="mt-4 text-[15px] font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-subtle">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** A failed load, with a retry button (or a log-in link when the session expired). */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const expired = error instanceof ApiError && error.status === 401;
  return (
    <div role="alert" className="flex flex-col items-center rounded-xl border border-line px-6 py-14 text-center">
      <span className="grid size-11 place-items-center rounded-xl bg-danger/10 text-danger">
        <WarningCircle size={22} weight="duotone" />
      </span>
      <p className="mt-4 text-[15px] font-medium text-ink">Couldn&apos;t load this</p>
      <p className="mt-1 max-w-sm text-[13px] text-subtle">{errorMessage(error)}</p>
      <div className="mt-5">
        {expired ? (
          <Button asChild>
            <Link href="/login?next=/admin">Log in again</Link>
          </Button>
        ) : (
          onRetry && (
            <Button variant="outline" onClick={onRetry}>
              <ArrowClockwise /> Try again
            </Button>
          )
        )}
      </div>
    </div>
  );
}

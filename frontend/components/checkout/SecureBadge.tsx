"use client";

import { usePathname } from "next/navigation";
import { LockKey } from "@phosphor-icons/react";

// Shown while paying; hidden once the order is confirmed.
export function SecureBadge() {
  const pathname = usePathname();
  if (pathname !== "/checkout") return null;
  return (
    <p className="flex items-center gap-2 text-[14px] font-medium text-subtle">
      <LockKey size={16} />
      Secure checkout
    </p>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { adminInventory, adminOrders } from "@/lib/api/admin";
import { useAdminQuery } from "./useAdminQuery";

/** Confirmed orders waiting to be packed. Rechecked on every admin page change. */
export function useOrdersToPack(): number | undefined {
  const pathname = usePathname();
  return useAdminQuery(`to-pack:${pathname}`, () =>
    adminOrders.list({ status: "confirmed", limit: 1 }).then((r) => r.total),
  ).data;
}

/** Variants that are low or out of stock. Rechecked on every admin page change. */
export function useLowStock(): number | undefined {
  const pathname = usePathname();
  return useAdminQuery(`low-stock:${pathname}`, () =>
    adminInventory.list({ limit: 1 }).then((r) => r.summary.low + r.summary.out),
  ).data;
}

"use client";

import { useRouter } from "next/navigation";
import { getProduct } from "@/lib/catalog";
import { useCartStore } from "@/store/cartStore";
import type { Order } from "@/store/orderStore";

// Puts every still-available item from a past order back in the bag, then opens it.
export function useBuyAgain() {
  const router = useRouter();
  const add = useCartStore((s) => s.add);

  return (order: Order) => {
    for (const line of order.lines) {
      if (getProduct(line.id)) add(line.id, line.quantity, line.color);
    }
    router.push("/cart");
  };
}

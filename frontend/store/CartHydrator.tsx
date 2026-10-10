"use client";

import { useEffect } from "react";
import { useCartStore } from "./cartStore";
import { useOrderStore } from "./orderStore";
import { useUserStore } from "./userStore";
import { useWishlistStore } from "./wishlistStore";
import { useAddressStore } from "./addressStore";

// Loads the saved cart, order history, session and wishlist from localStorage once the app has mounted.
export function CartHydrator() {
  useEffect(() => {
    void useCartStore.persist.rehydrate();
    void useOrderStore.persist.rehydrate();
    void useUserStore.persist.rehydrate();
    void useWishlistStore.persist.rehydrate();
    void useAddressStore.persist.rehydrate();
  }, []);
  return null;
}

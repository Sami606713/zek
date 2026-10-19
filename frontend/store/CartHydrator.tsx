"use client";

import { useEffect } from "react";
import { useCartStore } from "./cartStore";
import { useOrderStore } from "./orderStore";
import { useUserStore } from "./userStore";
import { useWishlistStore } from "./wishlistStore";
import { useAddressStore } from "./addressStore";
import { refreshSession, tokenExpiry } from "@/lib/api/session";

// Who the bag on this browser last belonged to ("guest" or a user id), to spot a sign-in.
const CART_OWNER_KEY = "zek-cart-owner";

// Loads the saved cart, order history, session and wishlist from localStorage once the app has mounted.
export function CartHydrator() {
  useEffect(() => {
    void useCartStore.persist.rehydrate();
    void useOrderStore.persist.rehydrate();
    void useUserStore.persist.rehydrate();
    void useWishlistStore.persist.rehydrate();
    void useAddressStore.persist.rehydrate();
  }, []);
  return (
    <>
      <CartSync />
      <SessionKeeper />
    </>
  );
}

/** Refreshes the login a minute before it expires, so the chat and account pages never hit an expired one. */
function SessionKeeper() {
  const token = useUserStore((s) => s.user?.token);

  useEffect(() => {
    if (!token) return;
    const wait = Math.max(0, tokenExpiry(token) - Date.now() - 60_000);
    // Refreshing stores a new token, which re-runs this effect and schedules the next refresh.
    const timer = window.setTimeout(() => void refreshSession(), wait);
    return () => window.clearTimeout(timer);
  }, [token]);

  return null;
}

/**
 * Keeps the bag, wishlist and saved addresses equal to the account on the server
 * (the bag is also what checkout and the AI agent use):
 * - sign-in: the guest bag and guest wishlist are added to the account, then loaded
 * - reload while signed in: everything is reloaded
 * - sign-out: back to the guest bag; the previous account's wishlist and addresses are cleared
 * - another account signs in: the previous one's wishlist isn't carried over
 * The bag also reloads when the shopper returns to the tab.
 */
function CartSync() {
  const userReady = useUserStore((s) => s.hydrated);
  const cartReady = useCartStore((s) => s.hydrated);
  const ready = userReady && cartReady;
  const owner = useUserStore((s) => s.user?.id ?? "guest");

  useEffect(() => {
    if (!ready) return;
    let previous: string | null = null;
    try {
      previous = localStorage.getItem(CART_OWNER_KEY);
      localStorage.setItem(CART_OWNER_KEY, owner);
    } catch {
      // storage blocked: still load everything
    }
    const cart = useCartStore.getState();
    const wishlist = useWishlistStore.getState();
    const addresses = useAddressStore.getState();

    if (owner === "guest") {
      void cart.refresh().catch(() => {}); // backend unreachable: keep the saved bag
      if (previous && previous !== "guest") {
        wishlist.reset();
        addresses.reset();
      }
      return;
    }
    if (previous === owner) {
      void cart.refresh().catch(() => {});
      void wishlist.load();
    } else {
      void cart.mergeGuest();
      if (previous === "guest" || previous === null) void wishlist.mergeLocal();
      else {
        wishlist.reset(); // another account was signed in on this browser
        void wishlist.load();
      }
    }
    void addresses.load();
  }, [ready, owner]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void useCartStore.getState().refresh().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return null;
}

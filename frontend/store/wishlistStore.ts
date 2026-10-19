import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import * as wishlistApi from "@/lib/api/wishlist";
import { useUserStore } from "./userStore";

// Product slugs the shopper saved. Signed in, the account's wishlist on the server is
// the source of truth (so it follows them across devices); guests keep it in this browser
// and it's added to their account when they sign in.
type WishlistState = {
  ids: string[];
  hydrated: boolean;
  toggle: (id: string) => Promise<boolean>;
  remove: (id: string) => void;
  clear: () => void;
  /** Undo: put back a previous list (re-adding what was removed). */
  restore: (ids: string[]) => void;
  /** Signed in: load the account's wishlist. */
  load: () => Promise<void>;
  /** After sign-in: add this browser's guest saves to the account, then load it. */
  mergeLocal: () => Promise<void>;
  /** After sign-out: forget the previous account's list. */
  reset: () => void;
};

const signedIn = () => Boolean(useUserStore.getState().user?.token);

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      hydrated: false,
      toggle: async (id) => {
        const saved = get().ids.includes(id);
        set({ ids: saved ? get().ids.filter((x) => x !== id) : [id, ...get().ids] });
        if (signedIn()) {
          try {
            await (saved ? wishlistApi.removeFromWishlist(id) : wishlistApi.addToWishlist(id));
          } catch {
            // Didn't save on the server: show the real state again.
            await get().load();
            return get().ids.includes(id);
          }
        }
        return !saved;
      },
      remove: (id) => {
        set({ ids: get().ids.filter((x) => x !== id) });
        if (signedIn()) void wishlistApi.removeFromWishlist(id).catch(() => get().load());
      },
      clear: () => {
        set({ ids: [] });
        if (signedIn()) void wishlistApi.clearWishlist().catch(() => get().load());
      },
      restore: (ids) => {
        const missing = ids.filter((id) => !get().ids.includes(id));
        set({ ids });
        if (signedIn()) {
          void Promise.all(missing.map((id) => wishlistApi.addToWishlist(id))).catch(() => get().load());
        }
      },
      load: async () => {
        try {
          set({ ids: await wishlistApi.fetchWishlistSlugs() });
        } catch {
          // offline or not signed in: keep what's shown
        }
      },
      mergeLocal: async () => {
        const local = get().ids;
        try {
          const server = await wishlistApi.fetchWishlistSlugs();
          const missing = local.filter((id) => !server.includes(id));
          await Promise.allSettled(missing.map((id) => wishlistApi.addToWishlist(id)));
        } finally {
          await get().load();
        }
      },
      reset: () => set({ ids: [] }),
    }),
    {
      name: "zek-wishlist",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ ids }) => ({ ids }),
      skipHydration: true,
      onRehydrateStorage: () => () => useWishlistStore.setState({ hydrated: true }),
    },
  ),
);

export const useIsSaved = (id: string) => useWishlistStore((s) => s.ids.includes(id));

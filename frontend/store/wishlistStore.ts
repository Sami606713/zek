import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import * as wishlistApi from "@/lib/api/wishlist";

type WishlistState = {
  ids: string[];
  hydrated: boolean;
  toggle: (id: string) => Promise<boolean>;
  remove: (id: string) => void;
  clear: () => void;
  syncFromServer: (ids: string[]) => void;
  fetchWishlist: () => Promise<void>;
};

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      hydrated: false,
      toggle: async (id) => {
        const saved = get().ids.includes(id);
        set({ ids: saved ? get().ids.filter((x) => x !== id) : [id, ...get().ids] });
        try {
          if (!saved) {
            await wishlistApi.addToWishlist(id);
          } else {
            await wishlistApi.removeFromWishlist(id);
          }
        } catch {}
        return !saved;
      },
      remove: (id) => set({ ids: get().ids.filter((x) => x !== id) }),
      clear: () => set({ ids: [] }),
      syncFromServer: (ids) => set({ ids }),
      fetchWishlist: async () => {
        try {
          const ids = await wishlistApi.fetchWishlistIds();
          set({ ids });
        } catch {}
      },
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

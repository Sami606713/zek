import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import * as cartApi from "@/lib/api/cart";

export type CartLine = {
  key: string;
  id: string;
  color?: string;
  quantity: number;
  product?: {
    name: string;
    brand: string;
    image: string;
    price: number;
    compareAt?: number;
  };
};

type CartState = {
  lines: CartLine[];
  promo: string | null;
  hydrated: boolean;
  syncing: boolean;
  add: (id: string, quantity?: number, color?: string, variantId?: string, product?: { name: string; brand: string; image: string; price: number; compareAt?: number }) => Promise<void>;
  setQuantity: (key: string, quantity: number) => Promise<void>;
  remove: (key: string) => Promise<void>;
  restore: (line: CartLine, index: number) => void;
  clear: () => Promise<void>;
  setPromo: (code: string | null) => void;
  applyPromo: (code: string) => Promise<void>;
  removePromo: () => Promise<void>;
  syncFromServer: (lines: CartLine[], promo: string | null) => void;
  refresh: () => Promise<void>;
};

const lineKey = (id: string, color?: string) => (color ? `${id}:${color}` : id);

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      promo: null,
      hydrated: false,
      syncing: false,
      add: async (id, quantity = 1, color, variantId, product) => {
        const key = lineKey(id, color);
        set((state) => {
          const existing = state.lines.find((line) => line.key === key);
          if (existing) {
            return {
              lines: state.lines.map((line) =>
                line.key === key ? { ...line, quantity: line.quantity + quantity } : line,
              ),
            };
          }
          return { lines: [...state.lines, { key, id, color, quantity, product }] };
        });
        if (variantId) {
          set({ syncing: true });
          try {
            const result = await cartApi.addToCart(variantId, quantity);
            get().syncFromServer(result.lines, result.promo);
          } finally {
            set({ syncing: false });
          }
        }
      },
      setQuantity: async (key, quantity) => {
        set((state) => ({
          lines: state.lines.map((line) =>
            line.key === key ? { ...line, quantity: Math.max(1, quantity) } : line,
          ),
        }));
        const line = get().lines.find((l) => l.key === key);
        if (line) {
          set({ syncing: true });
          try {
            const result = await cartApi.updateCartItem(line.key, quantity);
            get().syncFromServer(result.lines, result.promo);
          } finally {
            set({ syncing: false });
          }
        }
      },
      remove: async (key) => {
        set((state) => ({ lines: state.lines.filter((line) => line.key !== key) }));
        set({ syncing: true });
        try {
          const result = await cartApi.removeCartItem(key);
          get().syncFromServer(result.lines, result.promo);
        } finally {
          set({ syncing: false });
        }
      },
      restore: (line, index) =>
        set((state) => {
          const lines = [...state.lines];
          lines.splice(Math.min(index, lines.length), 0, line);
          return { lines };
        }),
      clear: async () => {
        set({ lines: [], promo: null });
        try {
          await cartApi.clearCart();
        } catch {}
      },
      setPromo: (promo) => set({ promo }),
      applyPromo: async (code) => {
        set({ syncing: true });
        try {
          const result = await cartApi.applyDiscount(code);
          get().syncFromServer(result.lines, result.promo);
        } finally {
          set({ syncing: false });
        }
      },
      removePromo: async () => {
        set({ syncing: true });
        try {
          const result = await cartApi.removeDiscount();
          get().syncFromServer(result.lines, result.promo);
        } finally {
          set({ syncing: false });
        }
      },
      syncFromServer: (lines, promo) => set({ lines, promo }),
      refresh: async () => {
        set({ syncing: true });
        try {
          const result = await cartApi.fetchCart();
          get().syncFromServer(result.lines, result.promo);
        } finally {
          set({ syncing: false });
        }
      },
    }),
    {
      name: "zek-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ lines, promo }) => ({ lines, promo }),
      skipHydration: true,
      onRehydrateStorage: () => () => {
        useCartStore.setState({ hydrated: true });
      },
    },
  ),
);

export const selectCartCount = (state: CartState) =>
  state.lines.reduce((total, line) => total + line.quantity, 0);

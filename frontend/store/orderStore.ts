import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import * as ordersApi from "@/lib/api/orders";
import type { Delivery } from "@/lib/pricing";
import type { ApiOrderStatus } from "@/lib/api/types";

export type OrderLine = {
  id: string;
  name: string;
  brand: string;
  image: string;
  color?: string;
  quantity: number;
  price: number;
};

export type Order = {
  id: string;
  createdAt: string;
  email: string;
  address: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    region: string;
    postal: string;
    country: string;
  };
  delivery: Delivery;
  payment: { method: "card"; last4: string } | { method: "cod" };
  lines: OrderLine[];
  totals: {
    subtotal: number;
    discount: number;
    shipping: number;
    tax: number;
    total: number;
  };
  promo: string | null;
  cancelledAt?: string;
  // Real fulfilment data from the server. Orders saved before these existed fall back
  // to the estimated timeline in lib/orderStatus.
  status?: ApiOrderStatus;
  canCancel?: boolean;
  packedAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  eta?: { from: string; to: string };
  tracking?: { carrier: string | null; number: string };
};

type OrderState = {
  orders: Order[];
  hydrated: boolean;
  loading: boolean;
  /** Keep a just-placed order (the confirmation page and guests read it from here). */
  addOrder: (order: Order) => void;
  cancelOrder: (id: string) => Promise<void>;
  /** Signed in: the account's orders from the server. Guest: refresh this browser's orders. */
  fetchOrders: (signedIn: boolean) => Promise<void>;
  setOrders: (orders: Order[]) => void;
};

const upsert = (orders: Order[], order: Order) =>
  orders.some((o) => o.id === order.id) ? orders.map((o) => (o.id === order.id ? order : o)) : [order, ...orders];

export const useOrderStore = create<OrderState>()(
  persist(
    (set, get) => ({
      orders: [],
      hydrated: false,
      loading: false,
      addOrder: (order) => set((state) => ({ orders: upsert(state.orders, order) })),
      cancelOrder: async (id) => {
        const order = get().orders.find((o) => o.id === id);
        const updated = await ordersApi.cancelOrder(id, "Customer requested cancellation", order?.email);
        set((state) => ({ orders: upsert(state.orders, updated) }));
      },
      fetchOrders: async (signedIn) => {
        set({ loading: true });
        try {
          if (signedIn) {
            set({ orders: await ordersApi.fetchOrders() });
            return;
          }
          // Guests: re-read each order placed in this browser for its latest status.
          // Orders the server doesn't know (from before checkout was connected) stay as they are.
          const current = get().orders;
          const fresh = await Promise.all(
            current.map((o) => ordersApi.fetchOrder(o.id, o.email).catch(() => o)),
          );
          set({ orders: fresh });
        } finally {
          set({ loading: false });
        }
      },
      setOrders: (orders) => set({ orders }),
    }),
    {
      name: "zek-orders",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ orders }) => ({ orders }),
      skipHydration: true,
      onRehydrateStorage: () => () => {
        useOrderStore.setState({ hydrated: true });
      },
    },
  ),
);

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import * as ordersApi from "@/lib/api/orders";
import type { Delivery } from "@/lib/pricing";

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
};

type OrderState = {
  orders: Order[];
  hydrated: boolean;
  loading: boolean;
  placeOrder: (order: Omit<Order, "id" | "createdAt">) => Order;
  cancelOrder: (id: string) => Promise<void>;
  fetchOrders: () => Promise<void>;
  setOrders: (orders: Order[]) => void;
};

export const useOrderStore = create<OrderState>()(
  persist(
    (set, get) => ({
      orders: [],
      hydrated: false,
      loading: false,
      placeOrder: (input) => {
        const order: Order = { ...input, id: `ZEK-${Date.now()}`, createdAt: new Date().toISOString() };
        set((state) => ({ orders: [order, ...state.orders] }));
        return order;
      },
      cancelOrder: async (id) => {
        await ordersApi.cancelOrder(id, "Customer requested cancellation");
        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === id ? { ...o, cancelledAt: new Date().toISOString() } : o,
          ),
        }));
      },
      fetchOrders: async () => {
        set({ loading: true });
        try {
          const orders = await ordersApi.fetchOrders();
          set({ orders });
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

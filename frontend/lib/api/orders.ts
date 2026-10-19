import { api } from "./client";
import { mapOrder } from "./mappers";
import type { ApiOrder, ApiOrderSummary } from "./types";
import type { Order } from "@/store/orderStore";

/** POST /checkout. The items, prices and discount come from the server cart. */
export interface CheckoutInput {
  email: string;
  phone?: string;
  shipping_address: {
    full_name: string;
    phone?: string;
    line1: string;
    line2?: string;
    city: string;
    region: string;
    postal_code: string;
    country: string;
  };
  delivery_method: "standard" | "express";
  payment_method: "card" | "cod";
  card_last4?: string;
  /** What the shopper saw; the server refuses the order if the cart total changed meanwhile. */
  expected_total?: string;
}

export async function placeOrder(input: CheckoutInput): Promise<Order> {
  const order = await api.post<ApiOrder>("/checkout", { ...input, channel: "web" }, { guest: true });
  return mapOrder(order);
}

/** The signed-in customer's orders, newest first, with their items. */
export async function fetchOrders(): Promise<Order[]> {
  const data = await api.get<{ items: ApiOrderSummary[] }>("/orders?limit=50", { auth: true });
  // The list has no items; each card shows them, so load the full orders (a customer has few).
  return Promise.all(data.items.map((o) => fetchOrder(o.order_number)));
}

/** One order. Guests prove it's theirs with the email used at checkout. */
export async function fetchOrder(orderNumber: string, email?: string): Promise<Order> {
  const qs = email ? `?email=${encodeURIComponent(email)}` : "";
  const order = await api.get<ApiOrder>(`/orders/${orderNumber}${qs}`);
  return mapOrder(order);
}

/** Possible until the order is packed. Guests send the email used at checkout. */
export async function cancelOrder(orderNumber: string, reason?: string, email?: string): Promise<Order> {
  const order = await api.post<ApiOrder>(`/orders/${orderNumber}/cancel`, { reason, email });
  return mapOrder(order);
}

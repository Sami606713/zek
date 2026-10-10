import { api } from "./client";
import { mapOrder } from "./mappers";
import type { ApiOrder } from "./types";
import type { Order } from "@/store/orderStore";

export interface CheckoutInput {
  email: string;
  shipping_address: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    region: string;
    postal: string;
    country: string;
    phone?: string;
  };
  delivery_method: "standard" | "express";
  payment_method: "card" | "cod";
  card_last4?: string;
  expected_total?: string;
  discount_code?: string;
}

export async function placeOrder(input: CheckoutInput): Promise<Order> {
  const order = await api.post<ApiOrder>("/orders/checkout", input, { guest: true });
  return mapOrder(order);
}

export async function fetchOrders(): Promise<Order[]> {
  const data = await api.get<{ items: ApiOrder[] }>("/orders", { auth: true });
  return data.items.map(mapOrder);
}

export async function fetchOrder(orderNumber: string, email?: string): Promise<Order> {
  const qs = email ? `?email=${encodeURIComponent(email)}` : "";
  const order = await api.get<ApiOrder>(`/orders/${orderNumber}${qs}`);
  return mapOrder(order);
}

export async function cancelOrder(orderNumber: string, reason?: string): Promise<Order> {
  const order = await api.post<ApiOrder>(`/orders/${orderNumber}/cancel`, { reason });
  return mapOrder(order);
}

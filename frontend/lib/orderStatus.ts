import { addBusinessDays, estimateDelivery } from "./orderDates";
import type { Order } from "@/store/orderStore";

// Simulated fulfilment until the backend reports real tracking events.
export type OrderStatus = "confirmed" | "packed" | "shipped" | "delivered" | "cancelled";

export const statusLabels: Record<OrderStatus, string> = {
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function orderMilestones(order: Order) {
  const placed = new Date(order.createdAt);
  const eta = estimateDelivery(order.createdAt, order.delivery);
  return {
    placed,
    packed: new Date(placed.getTime() + 6 * 60 * 60 * 1000),
    shipped: addBusinessDays(placed, 1),
    delivered: eta.from,
    eta,
  };
}

export function orderStatus(order: Order, now = new Date()): OrderStatus {
  if (order.cancelledAt) return "cancelled";
  const m = orderMilestones(order);
  if (now >= m.delivered) return "delivered";
  if (now >= m.shipped) return "shipped";
  if (now >= m.packed) return "packed";
  return "confirmed";
}

// Orders can be cancelled until they are packed.
export const canCancel = (order: Order, now = new Date()) =>
  orderStatus(order, now) === "confirmed";

export const isInProgress = (status: OrderStatus) =>
  status === "confirmed" || status === "packed" || status === "shipped";

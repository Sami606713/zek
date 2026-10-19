import { addBusinessDays, estimateDelivery } from "./orderDates";
import type { Order } from "@/store/orderStore";

// What the customer sees. The server's "pending" (payment not confirmed yet) shows as
// "Confirmed" until it moves on; "returned" ends the order like "cancelled".
export type OrderStatus = "confirmed" | "packed" | "shipped" | "delivered" | "cancelled" | "returned";

export const statusLabels: Record<OrderStatus, string> = {
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

const STEPS = ["confirmed", "packed", "shipped", "delivered"] as const;
type Step = (typeof STEPS)[number];

/**
 * When each step happened (or is expected). Uses the server's real times; orders saved
 * before checkout was connected have none, so they keep the old estimate.
 */
export function orderMilestones(order: Order) {
  const placed = new Date(order.createdAt);
  const eta = order.eta
    ? { from: new Date(order.eta.from), to: new Date(order.eta.to) }
    : estimateDelivery(order.createdAt, order.delivery);
  return {
    placed,
    packed: order.packedAt ? new Date(order.packedAt) : new Date(placed.getTime() + 6 * 60 * 60 * 1000),
    shipped: order.shippedAt ? new Date(order.shippedAt) : addBusinessDays(placed, 1),
    delivered: order.deliveredAt ? new Date(order.deliveredAt) : eta.from,
    eta,
  };
}

export function orderStatus(order: Order, now = new Date()): OrderStatus {
  if (order.status) return order.status === "pending" ? "confirmed" : order.status;
  // Legacy local order: estimate from the time since it was placed.
  if (order.cancelledAt) return "cancelled";
  const m = orderMilestones(order);
  if (now >= m.delivered) return "delivered";
  if (now >= m.shipped) return "shipped";
  if (now >= m.packed) return "packed";
  return "confirmed";
}

/** Whether the order has reached this step of the confirmed → delivered path. */
export function stepReached(status: OrderStatus, step: Step) {
  const at = STEPS.indexOf(status as Step);
  return at >= 0 && at >= STEPS.indexOf(step);
}

// The server decides (until the order is packed); legacy orders use the estimate.
export const canCancel = (order: Order, now = new Date()) =>
  order.canCancel ?? orderStatus(order, now) === "confirmed";

export const isInProgress = (status: OrderStatus) =>
  status === "confirmed" || status === "packed" || status === "shipped";

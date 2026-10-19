"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowsClockwise, MagnifyingGlass, Package } from "@phosphor-icons/react";
import { formatPrice } from "@/lib/catalog";
import { formatLongDate, formatRange, formatShortDate } from "@/lib/orderDates";
import { isInProgress, orderMilestones, orderStatus, type OrderStatus } from "@/lib/orderStatus";
import { useOrderStore, type Order } from "@/store/orderStore";
import { useUserStore } from "@/store/userStore";
import { StatusBadge } from "./StatusBadge";
import { useBuyAgain } from "./useBuyAgain";
import { useEffect } from "react";

function useOrderData() {
  const fetchOrders = useOrderStore((s) => s.fetchOrders);
  const loading = useOrderStore((s) => s.loading);
  const ordersReady = useOrderStore((s) => s.hydrated);
  // Wait for the saved session, then load the account's orders (or refresh a guest's).
  const account = useUserStore((s) => (s.hydrated ? (s.user?.id ?? "guest") : null));
  useEffect(() => {
    if (!account || !ordersReady) return;
    fetchOrders(account !== "guest").catch(() => {});
  }, [account, ordersReady, fetchOrders]);
  return loading;
}

const ease = [0.16, 1, 0.3, 1] as const;

const tabs = [
  { value: "all", label: "All" },
  { value: "progress", label: "In progress" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
] as const;

type Tab = (typeof tabs)[number]["value"];

const matchesTab = (status: OrderStatus, tab: Tab) =>
  tab === "all" ||
  (tab === "progress" && isInProgress(status)) ||
  (tab === "delivered" && status === "delivered") ||
  (tab === "cancelled" && (status === "cancelled" || status === "returned"));

function statusLine(order: Order, status: OrderStatus) {
  const m = orderMilestones(order);
  switch (status) {
    case "delivered":
      return `Delivered ${formatShortDate(m.delivered)}`;
    case "cancelled":
      return `Cancelled ${formatShortDate(new Date(order.cancelledAt ?? order.createdAt))}`;
    case "returned":
      return "Returned";
    default:
      return `Arriving ${formatRange(m.eta)}`;
  }
}

function OrderCard({ order, index }: { order: Order; index: number }) {
  const status = orderStatus(order);
  const buyAgain = useBuyAgain();
  const itemCount = order.lines.reduce((n, l) => n + l.quantity, 0);
  const shown = order.lines.slice(0, 4);
  const extra = order.lines.length - shown.length;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.5, delay: Math.min(index, 6) * 0.05, ease }}
      className="rounded-panel bg-surface"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line px-5 py-4 md:px-6">
        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-[14px]">
          <div>
            <dt className="text-subtle">Order</dt>
            <dd className="font-mono font-medium text-ink">{order.id}</dd>
          </div>
          <div>
            <dt className="text-subtle">Placed</dt>
            <dd className="text-ink">{formatLongDate(new Date(order.createdAt))}</dd>
          </div>
          <div>
            <dt className="text-subtle">Total</dt>
            <dd className="font-medium text-ink">{formatPrice(order.totals.total)}</dd>
          </div>
        </dl>
        <StatusBadge status={status} />
      </div>

      <div className="flex flex-col gap-5 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
          <ul className="flex shrink-0 -space-x-3">
            {shown.map((line) => (
              <li
                key={`${line.id}-${line.color ?? ""}`}
                className="relative size-14 overflow-hidden rounded-[12px] border-2 border-surface bg-surface-2"
              >
                <Image src={line.image} alt={line.name} fill sizes="56px" className="object-cover" />
              </li>
            ))}
            {extra > 0 && (
              <li className="grid size-14 place-items-center rounded-[12px] border-2 border-surface bg-surface-2 text-[13px] font-medium text-ink">
                +{extra}
              </li>
            )}
          </ul>
          <div className="w-full min-w-0 sm:w-auto sm:flex-1">
            <p className="text-[15px] font-medium text-ink">{statusLine(order, status)}</p>
            <p className="truncate text-[14px] text-subtle">
              {itemCount} {itemCount === 1 ? "item" : "items"}: {order.lines.map((l) => l.name).join(", ")}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => buyAgain(order)}
            className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2.5 text-[14px] font-medium text-ink transition hover:bg-surface-2 active:scale-[0.98]"
          >
            <ArrowsClockwise size={16} />
            Buy again
          </button>
          <Link
            href={`/orders/${order.id}`}
            className="group inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[14px] font-medium text-bg transition hover:opacity-90 active:scale-[0.98]"
          >
            View order
            <ArrowRight size={14} weight="bold" className="transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </motion.li>
  );
}

export function OrdersView() {
  const orders = useOrderStore((s) => s.orders);
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const loading = useOrderData();

  const q = query.trim().toLowerCase();
  const visible = orders.filter(
    (o) =>
      matchesTab(orderStatus(o), tab) &&
      (!q || o.id.toLowerCase().includes(q) || o.lines.some((l) => l.name.toLowerCase().includes(q))),
  );

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-24 pt-24 md:px-8 md:pt-28">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
      >
        <h1 className="text-4xl font-semibold tracking-[-0.04em] text-ink md:text-6xl">Orders</h1>
        <p className="mt-3 text-[16px] text-subtle">Track deliveries, reorder favorites and check past purchases.</p>
      </motion.div>

      {loading && (
        <div aria-busy="true" aria-label="Loading orders" className="mt-10 flex animate-pulse flex-col gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-44 rounded-panel bg-surface-2" />
          ))}
        </div>
      )}

      {!loading && orders.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="mt-10 flex flex-col items-start gap-4 rounded-panel bg-surface px-6 py-14 md:px-12"
        >
          <span className="grid size-14 place-items-center rounded-full bg-brand-soft text-brand">
            <Package size={26} />
          </span>
          <h2 className="text-2xl font-semibold tracking-[-0.03em] text-ink md:text-3xl">No orders yet</h2>
          <p className="max-w-[46ch] text-[16px] text-subtle">
            When you place an order it will show up here, with live delivery status.
          </p>
          <Link
            href="/products"
            className="mt-2 rounded-full bg-ink px-6 py-3.5 text-[15px] font-medium text-bg transition hover:opacity-90"
          >
            Start shopping
          </Link>
        </motion.div>
      )}

      {!loading && orders.length > 0 && (
        <>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <nav aria-label="Filter orders" className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <ul className="flex w-max gap-2">
                {tabs.map((t) => {
                  const count = orders.filter((o) => matchesTab(orderStatus(o), t.value)).length;
                  if (t.value === "cancelled" && count === 0) return null;
                  const active = tab === t.value;
                  return (
                    <li key={t.value} className="relative">
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => setTab(t.value)}
                        className={`relative z-10 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[14px] font-medium transition-colors ${
                          active ? "border-transparent text-bg" : "border-line text-ink hover:bg-surface-2"
                        }`}
                      >
                        {t.label}
                        <span className={`text-[12px] ${active ? "text-bg/70" : "text-subtle"}`}>{count}</span>
                      </button>
                      {active && (
                        <motion.span
                          layoutId="orders-tab"
                          className="absolute inset-0 rounded-full bg-ink"
                          transition={{ type: "spring", stiffness: 400, damping: 34 }}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </nav>
            <label className="relative sm:w-72">
              <span className="sr-only">Search orders</span>
              <MagnifyingGlass size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-subtle" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Order number or product"
                className="w-full rounded-full border border-line bg-surface py-2.5 pl-11 pr-4 text-[15px] text-ink outline-none transition placeholder:text-subtle focus:border-brand"
              />
            </label>
          </div>

          {visible.length === 0 ? (
            <p className="mt-10 rounded-panel bg-surface px-6 py-10 text-[15px] text-subtle">
              No orders match. Try another filter or search term.
            </p>
          ) : (
            <ul className="mt-6 flex flex-col gap-4">
              <AnimatePresence mode="popLayout" initial={false}>
                {visible.map((order, i) => (
                  <OrderCard key={order.id} order={order} index={i} />
                ))}
              </AnimatePresence>
            </ul>
          )}
        </>
      )}
    </div>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowsClockwise,
  CaretRight,
  CheckCircle,
  CreditCard,
  MapPin,
  Money,
  Package,
  Printer,
  Question,
  Truck,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import { formatPrice } from "@/lib/catalog";
import { deliveryOptions } from "@/lib/pricing";
import { formatLongDate, formatRange, formatShortDate } from "@/lib/orderDates";
import { canCancel, orderMilestones, orderStatus, stepReached } from "@/lib/orderStatus";
import { useOrderStore, type Order } from "@/store/orderStore";
import { useUserStore } from "@/store/userStore";
import { fetchOrder } from "@/lib/api/orders";
import { StatusBadge } from "./StatusBadge";
import { useBuyAgain } from "./useBuyAgain";

const ease = [0.16, 1, 0.3, 1] as const;

const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

function Timeline({ order }: { order: Order }) {
  const now = new Date();
  const m = orderMilestones(order);
  const status = orderStatus(order, now);

  const ended = status === "cancelled" || status === "returned";
  const steps = ended
    ? [
        { icon: CheckCircle, label: "Order placed", at: m.placed, done: true },
        {
          icon: XCircle,
          label: status === "returned" ? "Returned" : "Cancelled",
          at: new Date(order.cancelledAt ?? order.deliveredAt ?? order.createdAt),
          done: true,
        },
      ]
    : [
        { icon: CheckCircle, label: "Order confirmed", at: m.placed, done: true },
        { icon: Package, label: "Packed", at: m.packed, done: stepReached(status, "packed") },
        { icon: Truck, label: "Shipped", at: m.shipped, done: stepReached(status, "shipped") },
        { icon: MapPin, label: "Delivered", at: m.delivered, done: stepReached(status, "delivered") },
      ];

  const current = steps.filter((s) => s.done).length - 1;

  return (
    <ol className="flex flex-col">
      {steps.map(({ icon: Icon, label, at, done }, i) => (
        <li key={label} className="relative flex gap-4 pb-8 last:pb-0">
          {i < steps.length - 1 && (
            <span aria-hidden className="absolute left-5 top-10 h-[calc(100%-2.5rem)] w-px bg-line">
              <motion.span
                className="absolute inset-0 origin-top bg-brand"
                initial={{ scaleY: 0 }}
                animate={{ scaleY: steps[i + 1].done ? 1 : 0 }}
                transition={{ duration: 0.6, delay: 0.3 + i * 0.15, ease }}
              />
            </span>
          )}
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.15 + i * 0.12 }}
            className={`relative z-10 grid size-10 shrink-0 place-items-center rounded-full ${
              done
                ? label === "Cancelled" || label === "Returned"
                  ? "bg-surface-2 text-subtle"
                  : "bg-brand text-brand-ink"
                : "border border-line bg-bg text-subtle"
            } ${i === current && status !== "delivered" && !ended ? "ring-4 ring-brand-soft" : ""}`}
          >
            <Icon size={18} weight={done ? "fill" : "regular"} />
          </motion.span>
          <div className="pt-1.5">
            <p className={`text-[15px] font-medium ${done ? "text-ink" : "text-subtle"}`}>{label}</p>
            <p className="mt-0.5 text-[13px] text-subtle">
              {done
                ? `${formatShortDate(at)}, ${timeFmt.format(at)}`
                : label === "Delivered"
                  ? `Expected ${formatRange(m.eta)}`
                  : `Expected ${formatShortDate(at)}`}
            </p>
            {label === "Shipped" && done && order.tracking && (
              <p className="mt-1 text-[13px] text-ink">
                {order.tracking.carrier ? `${order.tracking.carrier} · ` : ""}
                Tracking <span className="font-mono font-medium">{order.tracking.number}</span>
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function CancelDialog({
  open,
  onClose,
  onConfirm,
  orderId,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  orderId: string;
}) {
  const keepRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    keepRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-[#0e0f12]/50"
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cancel-title"
            aria-describedby="cancel-desc"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-panel bg-bg p-6 shadow-soft sm:bottom-auto sm:top-1/3"
          >
            <span className="grid size-11 place-items-center rounded-full bg-surface-2 text-ink">
              <WarningCircle size={22} />
            </span>
            <h2 id="cancel-title" className="mt-4 text-xl font-semibold tracking-[-0.02em] text-ink">
              Cancel order {orderId}?
            </h2>
            <p id="cancel-desc" className="mt-2 text-[15px] leading-relaxed text-subtle">
              Nothing has shipped yet. If you paid by card, the full amount goes back to your card within 5 to 10 business days.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                ref={keepRef}
                type="button"
                onClick={onClose}
                className="rounded-full border border-line px-5 py-3 text-[14px] font-medium text-ink transition hover:bg-surface-2"
              >
                Keep order
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="rounded-full bg-[#c62f2f] px-5 py-3 text-[14px] font-medium text-[#fbfbfc] transition hover:opacity-90 active:scale-[0.98]"
              >
                Cancel order
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function OrderDetailView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const hydrated = useOrderStore((s) => s.hydrated);
  const order = useOrderStore((s) => s.orders.find((o) => o.id === id));
  const cancelOrder = useOrderStore((s) => s.cancelOrder);
  const buyAgain = useBuyAgain();
  const [confirming, setConfirming] = useState(false);
  const signedIn = useUserStore((s) => (s.hydrated ? Boolean(s.user) : null));
  const [loadedId, setLoadedId] = useState<string | null>(null);

  // Always load the latest version, so status changes made by the store (packed,
  // shipped, tracking) show up even when an older copy is saved in this browser.
  useEffect(() => {
    if (!hydrated || signedIn === null) return;
    let alive = true;
    const saved = useOrderStore.getState().orders.find((o) => o.id === id);
    fetchOrder(id, signedIn ? undefined : saved?.email)
      .then((fresh) => alive && useOrderStore.getState().addOrder(fresh))
      .catch(() => {})
      .finally(() => alive && setLoadedId(id));
    return () => {
      alive = false;
    };
  }, [hydrated, signedIn, id]);
  const fetching = loadedId !== id && !order;

  if (!hydrated || fetching) {
    return (
      <div aria-busy="true" aria-label="Loading order" className="mx-auto max-w-[1100px] animate-pulse px-4 pb-24 pt-24 md:px-8 md:pt-28">
        <div className="h-4 w-40 rounded-full bg-surface-2" />
        <div className="mt-6 h-12 w-80 rounded-full bg-surface-2" />
        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="h-80 rounded-panel bg-surface-2 lg:col-span-5" />
          <div className="h-80 rounded-panel bg-surface-2 lg:col-span-7" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-[1100px] px-4 pb-24 pt-24 md:px-8 md:pt-28">
        <div className="flex flex-col items-start gap-4 rounded-panel bg-surface px-6 py-14 md:px-12">
          <span className="grid size-14 place-items-center rounded-full bg-surface-2 text-subtle">
            <WarningCircle size={26} />
          </span>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-ink md:text-3xl">We could not find order {id}</h1>
          <p className="max-w-[50ch] text-[16px] text-subtle">
            It may have been placed on another device. Check the number in your confirmation email.
          </p>
          <Link href="/orders" className="mt-2 rounded-full bg-ink px-6 py-3.5 text-[15px] font-medium text-bg transition hover:opacity-90">
            Back to orders
          </Link>
        </div>
      </div>
    );
  }

  const status = orderStatus(order);
  const m = orderMilestones(order);
  const deliveryLabel = deliveryOptions.find((d) => d.value === order.delivery)?.label ?? "Standard";
  const cancellable = canCancel(order);

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-24 pt-24 md:px-8 md:pt-28">
      <nav aria-label="Breadcrumb" className="mb-6 print:hidden">
        <ol className="flex items-center gap-1.5 text-[13px] text-subtle">
          <li>
            <Link href="/orders" className="hover:text-ink">Orders</Link>
          </li>
          <li aria-current="page" className="flex items-center gap-1.5 text-ink">
            <CaretRight size={12} aria-hidden className="text-subtle" />
            {order.id}
          </li>
        </ol>
      </nav>

      <motion.header
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
        className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between"
      >
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-3xl font-semibold tracking-[-0.03em] text-ink md:text-4xl">{order.id}</h1>
            <StatusBadge status={status} />
          </div>
          <p className="mt-2 text-[15px] text-subtle">
            Placed {formatLongDate(m.placed)} at {timeFmt.format(m.placed)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={() => buyAgain(order)}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[14px] font-medium text-bg transition hover:opacity-90 active:scale-[0.98]"
          >
            <ArrowsClockwise size={16} />
            Buy again
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-[14px] font-medium text-ink transition hover:bg-surface-2"
          >
            <Printer size={16} />
            Print receipt
          </button>
          {cancellable && (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-[14px] font-medium text-[#c62f2f] transition hover:bg-surface-2 dark:text-[#ff8a8a]"
            >
              <XCircle size={16} />
              Cancel order
            </button>
          )}
        </div>
      </motion.header>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.08, ease }}
          aria-label="Tracking"
          className="rounded-panel bg-surface p-6 md:p-8 lg:col-span-5"
        >
          <h2 className="text-[17px] font-semibold text-ink">
            {status === "delivered"
              ? `Delivered ${formatShortDate(m.delivered)}`
              : status === "cancelled"
                ? "This order was cancelled"
                : `Arriving ${formatRange(m.eta)}`}
          </h2>
          <p className="mt-1 text-[14px] text-subtle">{deliveryLabel} delivery</p>
          <div className="mt-8">
            <Timeline order={order} />
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.16, ease }}
          aria-label="Items and payment"
          className="rounded-panel bg-surface p-6 md:p-8 lg:col-span-7"
        >
          <h2 className="text-[17px] font-semibold text-ink">Items</h2>
          <ul className="mt-5 flex flex-col gap-4">
            {order.lines.map((line) => (
              <li key={`${line.id}-${line.color ?? ""}`} className="flex items-center gap-4">
                <Link href={`/products/${line.id}`} className="relative size-16 shrink-0 overflow-hidden rounded-[12px] bg-surface-2">
                  <Image src={line.image} alt={line.name} fill sizes="64px" className="object-cover" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/products/${line.id}`} className="block truncate text-[15px] font-medium text-ink hover:underline">
                    {line.name}
                  </Link>
                  <p className="text-[13px] text-subtle">
                    {line.brand}
                    {line.color ? `, ${line.color}` : ""}, Qty {line.quantity}
                  </p>
                </div>
                <p className="shrink-0 text-[15px] font-medium text-ink">{formatPrice(line.price * line.quantity)}</p>
              </li>
            ))}
          </ul>

          <dl className="mt-6 flex flex-col gap-2.5 border-t border-line pt-5 text-[15px]">
            <div className="flex justify-between gap-4">
              <dt className="text-subtle">Subtotal</dt>
              <dd className="text-ink">{formatPrice(order.totals.subtotal)}</dd>
            </div>
            {order.totals.discount > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-subtle">Discount{order.promo ? ` (${order.promo})` : ""}</dt>
                <dd className="font-medium text-brand">-{formatPrice(order.totals.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-subtle">Shipping</dt>
              <dd className="text-ink">{order.totals.shipping === 0 ? "Free" : formatPrice(order.totals.shipping)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-subtle">Tax</dt>
              <dd className="text-ink">{formatPrice(order.totals.tax)}</dd>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-line pt-4">
              <dt className="font-medium text-ink">Total</dt>
              <dd className="text-xl font-semibold tracking-[-0.02em] text-ink">{formatPrice(order.totals.total)}</dd>
            </div>
          </dl>

          <div className="mt-8 grid grid-cols-1 gap-6 border-t border-line pt-6 sm:grid-cols-2">
            <div>
              <h3 className="flex items-center gap-2 text-[14px] font-medium text-subtle">
                <MapPin size={16} /> Shipping to
              </h3>
              <address className="mt-2 text-[15px] not-italic leading-relaxed text-ink">
                {order.address.name}
                <br />
                {order.address.line1}
                {order.address.line2 && (
                  <>
                    <br />
                    {order.address.line2}
                  </>
                )}
                <br />
                {order.address.city}, {order.address.region} {order.address.postal}
                <br />
                {order.address.country}
              </address>
            </div>
            <div>
              <h3 className="flex items-center gap-2 text-[14px] font-medium text-subtle">
                {order.payment.method === "card" ? <CreditCard size={16} /> : <Money size={16} />} Payment
              </h3>
              <p className="mt-2 text-[15px] text-ink">
                {order.payment.method === "card" ? `Card ending in ${order.payment.last4}` : "Cash on delivery"}
              </p>
              <p className="text-[14px] text-subtle">
                {status === "cancelled"
                  ? order.payment.method === "card"
                    ? "Refund issued to your card"
                    : "Nothing to pay"
                  : order.payment.method === "card"
                    ? `Charged ${formatPrice(order.totals.total)}`
                    : `Pay ${formatPrice(order.totals.total)} on delivery`}
              </p>
              <p className="mt-3 text-[14px] text-subtle">Receipt sent to {order.email}</p>
            </div>
          </div>
        </motion.section>
      </div>

      <motion.aside
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.24, ease }}
        className="mt-6 flex flex-col items-start gap-4 rounded-panel bg-brand-soft p-6 sm:flex-row sm:items-center sm:justify-between md:px-8 print:hidden"
      >
        <div className="flex items-center gap-3">
          <Question size={22} className="shrink-0 text-brand" />
          <p className="text-[15px] text-ink">Need help with this order? Returns are free within 30 days of delivery.</p>
        </div>
        <Link
          href="/help"
          className="shrink-0 rounded-full bg-ink px-5 py-2.5 text-[14px] font-medium text-bg transition hover:opacity-90"
        >
          Get help
        </Link>
      </motion.aside>

      <CancelDialog
        open={confirming}
        orderId={order.id}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          cancelOrder(order.id);
          setConfirming(false);
        }}
      />
    </div>
  );
}

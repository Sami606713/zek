"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Check,
  CheckCircle,
  Copy,
  CreditCard,
  MapPin,
  Money,
  Package,
  Truck,
  WarningCircle,
} from "@phosphor-icons/react";
import { formatPrice } from "@/lib/catalog";
import { deliveryOptions } from "@/lib/pricing";
import { estimateDelivery, formatLongDate, formatRange, formatShortDate } from "@/lib/orderDates";
import { useOrderStore } from "@/store/orderStore";
import { fetchOrder } from "@/lib/api/orders";

const ease = [0.16, 1, 0.3, 1] as const;

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease },
});

function SuccessMark() {
  return (
    <div className="relative grid size-16 place-items-center">
      <motion.span
        className="absolute inset-0 rounded-full bg-brand-soft"
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: [0.4, 1.35, 1], opacity: [0, 1, 1] }}
        transition={{ duration: 0.9, ease }}
      />
      <motion.span
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.15 }}
        className="relative grid size-12 place-items-center rounded-full bg-brand text-brand-ink"
      >
        <Check size={24} weight="bold" />
      </motion.span>
    </div>
  );
}

function CopyOrderId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked; the number is still visible to copy by hand.
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Order number copied" : `Copy order number ${id}`}
      className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 font-mono text-[14px] text-ink transition hover:bg-surface-2 active:scale-[0.98]"
    >
      {id}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={copied ? "done" : "copy"}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.15 }}
          className="grid text-subtle"
        >
          {copied ? <Check size={14} weight="bold" className="text-brand" /> : <Copy size={14} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

export function ConfirmationSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your order" className="mx-auto max-w-[960px] animate-pulse px-4 py-14 md:px-8">
      <div className="size-16 rounded-full bg-surface-2" />
      <div className="mt-6 h-10 w-2/3 rounded-full bg-surface-2" />
      <div className="mt-4 h-4 w-1/2 rounded-full bg-surface-2" />
      <div className="mt-10 h-28 rounded-panel bg-surface-2" />
      <div className="mt-6 h-64 rounded-panel bg-surface-2" />
    </div>
  );
}

export function OrderConfirmation() {
  const params = useSearchParams();
  const orderId = params.get("order");
  const hydrated = useOrderStore((s) => s.hydrated);
  const order = useOrderStore((s) => s.orders.find((o) => o.id === orderId));
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const missing = hydrated && !order && Boolean(orderId);

  // Checkout saves the new order here; this covers a reload or a link opened elsewhere.
  useEffect(() => {
    if (!missing || !orderId) return;
    let alive = true;
    fetchOrder(orderId)
      .then((fetched) => alive && useOrderStore.getState().addOrder(fetched))
      .catch(() => {})
      .finally(() => alive && setLoadedId(orderId));
    return () => {
      alive = false;
    };
  }, [missing, orderId]);
  const fetching = missing && loadedId !== orderId;

  if (!hydrated || fetching) return <ConfirmationSkeleton />;

  if (!order) {
    return (
      <div className="mx-auto max-w-[960px] px-4 py-16 md:px-8">
        <div className="flex flex-col items-start gap-4 rounded-panel bg-surface px-6 py-14 md:px-12">
          <span className="grid size-14 place-items-center rounded-full bg-surface-2 text-subtle">
            <WarningCircle size={26} />
          </span>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-ink md:text-3xl">
            We could not find that order
          </h1>
          <p className="max-w-[50ch] text-[16px] text-subtle">
            {orderId
              ? `There is no order ${orderId} on this device. Check the link in your confirmation email, or see all your orders.`
              : "This page needs an order number. Check the link in your confirmation email, or see all your orders."}
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link href="/orders" className="rounded-full bg-ink px-6 py-3.5 text-[15px] font-medium text-bg transition hover:opacity-90">
              View your orders
            </Link>
            <Link href="/products" className="rounded-full border border-line px-6 py-3.5 text-[15px] font-medium text-ink transition hover:bg-surface-2">
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const placed = new Date(order.createdAt);
  const eta = estimateDelivery(order.createdAt, order.delivery);
  const deliveryLabel = deliveryOptions.find((d) => d.value === order.delivery)?.label ?? "Standard";
  const firstName = order.address.name.split(" ")[0];
  const itemCount = order.lines.reduce((n, l) => n + l.quantity, 0);

  const steps = [
    { icon: CheckCircle, label: "Confirmed", detail: formatShortDate(placed), done: true },
    { icon: Package, label: "Packed", detail: "Within 1 business day", done: false },
    { icon: Truck, label: "Shipped", detail: "Tracking sent by email", done: false },
    { icon: MapPin, label: "Delivered", detail: formatRange(eta), done: false },
  ];

  return (
    <div className="mx-auto max-w-[960px] px-4 pb-20 pt-10 md:px-8 md:pt-14">
      <SuccessMark />

      <motion.h1
        {...rise(0.2)}
        className="mt-6 text-4xl font-semibold tracking-[-0.045em] text-ink md:text-5xl"
      >
        Thank you, {firstName}.
      </motion.h1>
      <motion.p {...rise(0.28)} className="mt-3 max-w-[56ch] text-[17px] leading-relaxed text-subtle">
        Your order is confirmed. A receipt is on its way to{" "}
        <span className="font-medium text-ink">{order.email}</span>.
      </motion.p>

      <motion.div {...rise(0.36)} className="mt-6 flex flex-wrap items-center gap-3">
        <span className="text-[14px] text-subtle">Order number</span>
        <CopyOrderId id={order.id} />
      </motion.div>

      {/* What happens next */}
      <motion.section
        {...rise(0.44)}
        aria-label="Order progress"
        className="mt-10 rounded-panel bg-surface p-6 md:p-8"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[17px] font-semibold text-ink">Arriving {formatRange(eta)}</h2>
          <p className="text-[14px] text-subtle">{deliveryLabel} delivery</p>
        </div>
        <ol className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-4 sm:gap-3">
          {steps.map(({ icon: Icon, label, detail, done }, i) => (
            <li key={label} className="relative flex gap-4 sm:flex-col sm:gap-3">
              {i < steps.length - 1 && (
                <span
                  aria-hidden
                  className="absolute left-5 top-11 h-[calc(100%-1.25rem)] w-px bg-line sm:left-11 sm:top-5 sm:h-px sm:w-[calc(100%-2.75rem)]"
                />
              )}
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.55 + i * 0.1 }}
                className={`relative z-10 grid size-10 shrink-0 place-items-center rounded-full ${
                  done ? "bg-brand text-brand-ink" : "border border-line bg-bg text-subtle"
                }`}
              >
                <Icon size={18} weight={done ? "fill" : "regular"} />
              </motion.span>
              <div>
                <p className={`text-[15px] font-medium ${done ? "text-ink" : "text-subtle"}`}>{label}</p>
                <p className="mt-0.5 text-[13px] text-subtle">{detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </motion.section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Items */}
        <motion.section {...rise(0.52)} aria-label="Items" className="rounded-panel bg-surface p-6 md:p-8 lg:col-span-3">
          <h2 className="text-[17px] font-semibold text-ink">
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </h2>
          <ul className="mt-5 flex flex-col gap-4">
            {order.lines.map((line) => (
              <li key={`${line.id}-${line.color ?? ""}`} className="flex items-center gap-4">
                <Link
                  href={`/products/${line.id}`}
                  className="relative size-16 shrink-0 overflow-hidden rounded-[12px] bg-surface-2"
                >
                  <Image src={line.image} alt={line.name} fill sizes="64px" className="object-cover" />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-ink">{line.name}</p>
                  <p className="text-[13px] text-subtle">
                    {line.color ? `${line.color}, ` : ""}Qty {line.quantity}
                  </p>
                </div>
                <p className="shrink-0 text-[15px] font-medium text-ink">
                  {formatPrice(line.price * line.quantity)}
                </p>
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
              <dd className="text-ink">
                {order.totals.shipping === 0 ? "Free" : formatPrice(order.totals.shipping)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-subtle">Tax</dt>
              <dd className="text-ink">{formatPrice(order.totals.tax)}</dd>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-line pt-4">
              <dt className="font-medium text-ink">Total</dt>
              <dd className="text-xl font-semibold tracking-[-0.02em] text-ink">
                {formatPrice(order.totals.total)}
              </dd>
            </div>
          </dl>
        </motion.section>

        {/* Details */}
        <motion.section {...rise(0.6)} aria-label="Order details" className="flex flex-col gap-6 rounded-panel bg-surface p-6 md:p-8 lg:col-span-2">
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
              <Truck size={16} /> Delivery
            </h3>
            <p className="mt-2 text-[15px] text-ink">{deliveryLabel}</p>
            <p className="text-[14px] text-subtle">Estimated {formatRange(eta)}</p>
          </div>
          <div>
            <h3 className="flex items-center gap-2 text-[14px] font-medium text-subtle">
              {order.payment.method === "card" ? <CreditCard size={16} /> : <Money size={16} />} Payment
            </h3>
            <p className="mt-2 text-[15px] text-ink">
              {order.payment.method === "card"
                ? `Card ending in ${order.payment.last4}`
                : "Cash on delivery"}
            </p>
            <p className="text-[14px] text-subtle">
              {order.payment.method === "card"
                ? `Charged ${formatPrice(order.totals.total)} on ${formatLongDate(placed)}`
                : `Pay ${formatPrice(order.totals.total)} when it arrives`}
            </p>
          </div>
        </motion.section>
      </div>

      <motion.div {...rise(0.68)} className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/products"
          className="group inline-flex items-center justify-center gap-2 rounded-full bg-ink px-7 py-3.5 text-[15px] font-medium text-bg transition hover:opacity-90 active:scale-[0.98]"
        >
          Continue shopping
          <ArrowRight size={16} weight="bold" className="transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
        <Link
          href={`/orders/${order.id}`}
          className="inline-flex items-center justify-center rounded-full border border-line px-7 py-3.5 text-[15px] font-medium text-ink transition hover:bg-surface-2"
        >
          Track this order
        </Link>
      </motion.div>
    </div>
  );
}

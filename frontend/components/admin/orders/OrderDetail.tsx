"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useState } from "react";
import {
  ArrowCounterClockwise,
  ArrowUUpLeft,
  CheckCircle,
  DotsThree,
  MapPin,
  Package,
  Printer,
  Truck,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChannelLabel, FulfilmentBadge, PaymentBadge, orderStatusLabel } from "@/components/admin/badges";
import { ErrorState } from "@/components/admin/states";
import { formatDate, formatDateTime, formatMoney } from "@/lib/admin/format";
import { useAdminAction, useAdminQuery } from "@/lib/admin/useAdminQuery";
import { ApiError } from "@/lib/api/client";
import { adminOrders, type AdminOrderDetail, type OrderStatus } from "@/lib/api/admin";

const flow = ["confirmed", "packed", "shipped", "delivered"] as const;
const stepIcons = { confirmed: CheckCircle, packed: Package, shipped: Truck, delivered: MapPin };

const actionLabel: Partial<Record<OrderStatus, string>> = {
  confirmed: "Confirm order",
  packed: "Mark as packed",
  shipped: "Mark as shipped",
  delivered: "Mark as delivered",
  returned: "Mark as returned",
  cancelled: "Cancel order",
};

const money = (v: string | number) => formatMoney(Number(v));

/** When each step happened, from the order's own timestamps. */
function stepTime(order: AdminOrderDetail, step: (typeof flow)[number]) {
  const at = { confirmed: order.paid_at ?? order.created_at, packed: order.packed_at, shipped: order.shipped_at, delivered: order.delivered_at }[step];
  return at ? formatDate(at) : null;
}

export function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const order = useAdminQuery(`order:${id}`, () => adminOrders.get(id));

  if (order.loading) return <DetailSkeleton />;
  if (!order.data) {
    const missing = order.error instanceof ApiError && (order.error.status === 404 || order.error.status === 422);
    return missing ? <NotFound /> : <ErrorState error={order.error} onRetry={order.refetch} />;
  }
  // Remount the editable parts when the order changes on the server, so their fields reset.
  return <OrderView key={order.data.updated_at} order={order.data} refetch={order.refetch} busy={order.refreshing} />;
}

function OrderView({ order, refetch, busy }: { order: AdminOrderDetail; refetch: () => void; busy: boolean }) {
  const { run, pending } = useAdminAction();
  const [statusTarget, setStatusTarget] = useState<OrderStatus | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);

  const customerOrders = useAdminQuery(`customer-orders:${order.email}`, () =>
    adminOrders.list({ q: order.email, limit: 1 }).then((r) => r.total),
  );

  const next = order.allowed_next_statuses;
  const primary = next.find((s) => s !== "cancelled" && s !== "returned");
  const refundable = Number(order.total) - Number(order.refunded_total);
  const canRefund = (order.payment_status === "paid" || order.payment_status === "partially_refunded") && refundable > 0;
  const stepIndex = flow.indexOf(order.status as (typeof flow)[number]);
  const address = order.shipping_address;

  const save = async (body: Parameters<typeof adminOrders.update>[1], success: string) => {
    const ok = await run(() => adminOrders.update(order.id, body), success);
    if (ok) refetch();
    return Boolean(ok);
  };

  return (
    <div aria-busy={busy}>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/admin/orders" className="text-[13px] text-subtle hover:text-ink">
            ← Orders
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h1 className="font-mono text-2xl font-semibold tracking-[-0.02em] text-ink md:text-[28px]">{order.order_number}</h1>
            <FulfilmentBadge status={order.status} />
            <PaymentBadge status={order.payment_status} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-subtle">
            <span>{formatDateTime(order.created_at)}</span>
            <ChannelLabel channel={order.channel} />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {primary && (
            <Button onClick={() => setStatusTarget(primary)} disabled={pending}>
              {actionLabel[primary]}
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> Print
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <DotsThree weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem disabled={!canRefund} onSelect={() => setRefundOpen(true)}>
                <ArrowCounterClockwise /> Refund
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!next.includes("returned")} onSelect={() => setStatusTarget("returned")}>
                <ArrowUUpLeft /> Mark as returned
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={!next.includes("cancelled")}
                onSelect={() => setStatusTarget("cancelled")}
              >
                <XCircle /> Cancel order
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          {order.status === "cancelled" || order.status === "returned" ? (
            <Card>
              <CardContent className="flex items-start gap-3 p-5 text-[14px] text-ink">
                <XCircle size={20} className="mt-0.5 shrink-0 text-danger" />
                <div>
                  <p className="font-medium">
                    {order.status === "cancelled"
                      ? `Cancelled ${order.cancelled_at ? formatDateTime(order.cancelled_at) : ""}`
                      : "Returned by the customer"}
                  </p>
                  <p className="mt-0.5 text-subtle">
                    {order.cancel_reason ?? (order.status === "cancelled" ? "Stock was returned to inventory." : "Refund the payment if you haven't yet.")}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-5">
                {order.status === "pending" && (
                  <p className="mb-4 rounded-lg bg-brand-soft px-3 py-2 text-[13px] text-brand">
                    Waiting for payment. Confirm the order once it&apos;s paid.
                  </p>
                )}
                <ol className="grid grid-cols-4 gap-2">
                  {flow.map((s, i) => {
                    const Icon = stepIcons[s];
                    const done = i <= stepIndex;
                    return (
                      <li key={s} className="flex flex-col items-center gap-2 text-center">
                        <span className="relative flex w-full items-center">
                          <span className={`h-0.5 flex-1 ${i === 0 ? "bg-transparent" : i <= stepIndex ? "bg-brand" : "bg-line"}`} />
                          <span className={`grid size-9 shrink-0 place-items-center rounded-full ${done ? "bg-brand text-brand-ink" : "border border-line bg-bg text-subtle"}`}>
                            <Icon size={16} weight={done ? "fill" : "regular"} />
                          </span>
                          <span className={`h-0.5 flex-1 ${i === flow.length - 1 ? "bg-transparent" : i < stepIndex ? "bg-brand" : "bg-line"}`} />
                        </span>
                        <span className={`text-[12px] font-medium ${done ? "text-ink" : "text-subtle"}`}>{orderStatusLabel[s]}</span>
                        <span className="text-[11px] text-subtle">{done ? stepTime(order, s) : " "}</span>
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {order.items.map((l) => (
                <div key={l.id} className="flex items-center gap-4">
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                    {l.image_url && (
                      <Image src={l.image_url} alt="" fill sizes="56px" className="object-cover" unoptimized={!l.image_url.includes("picsum.photos")} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    {l.product_id ? (
                      <Link href={`/admin/products/${l.product_id}`} className="block truncate text-[14px] font-medium text-ink hover:underline">
                        {l.product_name}
                      </Link>
                    ) : (
                      <p className="truncate text-[14px] font-medium text-ink">{l.product_name}</p>
                    )}
                    <p className="text-[13px] text-subtle">
                      {[l.color_name, l.size, l.sku].filter(Boolean).join(" · ")}
                      {(l.color_name || l.size || l.sku) && " · "}
                      {money(l.unit_price)} × {l.quantity}
                    </p>
                  </div>
                  <p className="text-[14px] font-medium tabular-nums text-ink">{money(l.line_total)}</p>
                </div>
              ))}
              <Separator />
              <dl className="flex flex-col gap-2 text-[14px]">
                <Row label="Subtotal" value={money(order.subtotal)} />
                {Number(order.discount_total) > 0 && (
                  <Row label={`Discount${order.discount_code ? ` (${order.discount_code})` : ""}`} value={`-${money(order.discount_total)}`} accent />
                )}
                <Row
                  label={`Shipping (${order.delivery_method})`}
                  value={Number(order.shipping_total) ? money(order.shipping_total) : "Free"}
                />
                <Row label="Tax" value={money(order.tax_total)} />
                <div className="flex justify-between border-t border-line pt-3 text-[15px] font-semibold">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{money(order.total)}</dd>
                </div>
                {Number(order.refunded_total) > 0 && <Row label="Refunded" value={`-${money(order.refunded_total)}`} accent />}
                <div className="flex justify-between text-subtle">
                  <dt>Paid with</dt>
                  <dd>
                    {order.payment_method === "card"
                      ? `Card${order.card_last4 ? ` ending ${order.card_last4}` : ""}`
                      : "Cash on delivery"}
                    {order.paid_at && `, ${formatDate(order.paid_at)}`}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {order.customer_note && (
            <Card>
              <CardHeader>
                <CardTitle>Note from the customer</CardTitle>
              </CardHeader>
              <CardContent className="text-[14px] text-ink">{order.customer_note}</CardContent>
            </Card>
          )}

          <InternalNote order={order} save={save} pending={pending} />
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1 text-[14px]">
              {order.user_id ? (
                <Link href={`/admin/customers/${order.user_id}`} className="font-medium text-ink hover:underline">
                  {address.full_name}
                </Link>
              ) : (
                <p className="font-medium text-ink">
                  {address.full_name} <span className="font-normal text-subtle">(guest)</span>
                </p>
              )}
              <a href={`mailto:${order.email}`} className="truncate text-brand hover:underline">
                {order.email}
              </a>
              {(order.phone ?? address.phone) && <p className="text-subtle">{order.phone ?? address.phone}</p>}
              {customerOrders.data !== undefined && (
                <Link href={`/admin/orders?q=${encodeURIComponent(order.email)}`} className="mt-2 text-subtle hover:text-ink">
                  {customerOrders.data} {customerOrders.data === 1 ? "order" : "orders"} with this email →
                </Link>
              )}
            </CardContent>
          </Card>

          <ShippingCard order={order} save={save} pending={pending} />

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline order={order} />
            </CardContent>
          </Card>
        </div>
      </div>

      <StatusDialog order={order} target={statusTarget} onClose={() => setStatusTarget(null)} save={save} pending={pending} />
      <RefundDialog
        order={order}
        open={refundOpen}
        onOpenChange={setRefundOpen}
        refundable={refundable}
        onDone={refetch}
      />
    </div>
  );
}

type Save = (body: Parameters<typeof adminOrders.update>[1], success: string) => Promise<boolean>;

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-subtle">{label}</dt>
      <dd className={`tabular-nums ${accent ? "text-brand" : ""}`}>{value}</dd>
    </div>
  );
}

// ── Internal note (one note per order, team only) ───────────────────────────

function InternalNote({ order, save, pending }: { order: AdminOrderDetail; save: Save; pending: boolean }) {
  const [note, setNote] = useState(order.internal_note ?? "");
  const changed = note.trim() !== (order.internal_note ?? "");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Internal note</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save({ internal_note: note.trim() || null }, note.trim() ? "Note saved" : "Note removed");
          }}
          className="flex flex-col gap-2"
        >
          <Label htmlFor="order-note" className="sr-only">
            Internal note
          </Label>
          <Textarea
            id="order-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Only your team sees this. For example: customer asked for gift wrap"
            rows={3}
            maxLength={2000}
          />
          <Button type="submit" variant="outline" className="self-end" disabled={!changed || pending}>
            Save note
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Shipping: address, delivery window, carrier + tracking ──────────────────

function ShippingCard({ order, save, pending }: { order: AdminOrderDetail; save: Save; pending: boolean }) {
  const [carrier, setCarrier] = useState(order.carrier ?? "");
  const [tracking, setTracking] = useState(order.tracking_number ?? "");
  const changed = carrier.trim() !== (order.carrier ?? "") || tracking.trim() !== (order.tracking_number ?? "");
  const a = order.shipping_address;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Shipping</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-[14px]">
        <address className="not-italic leading-relaxed text-ink">
          {a.full_name}
          <br />
          {a.line1}
          {a.line2 && (
            <>
              <br />
              {a.line2}
            </>
          )}
          <br />
          {a.city}, {a.region} {a.postal_code}
          <br />
          {a.country}
        </address>
        <p className="text-subtle">
          {order.delivery_method === "express" ? "Express" : "Standard"}
          {order.estimated_delivery_from && order.estimated_delivery_to
            ? `, arrives ${formatDate(order.estimated_delivery_from)} to ${formatDate(order.estimated_delivery_to)}`
            : ""}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save(
              { carrier: carrier.trim() || null, tracking_number: tracking.trim() || null },
              tracking.trim() ? "Tracking saved" : "Tracking removed",
            );
          }}
          className="flex flex-col gap-2"
        >
          <div className="grid grid-cols-[2fr_3fr] gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="carrier">Carrier</Label>
              <Input id="carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="DHL" maxLength={50} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tracking">Tracking number</Label>
              <Input id="tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="1Z…" className="font-mono" maxLength={100} />
            </div>
          </div>
          <Button type="submit" variant="outline" className="self-end" disabled={!changed || pending}>
            Save tracking
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Timeline: status history + refunds, newest first ────────────────────────

function Timeline({ order }: { order: AdminOrderDetail }) {
  const events = [
    ...order.status_history.map((e) => ({
      at: e.created_at,
      label: e.from_status ? `${orderStatusLabel[e.from_status]} → ${orderStatusLabel[e.to_status]}` : `Order ${orderStatusLabel[e.to_status].toLowerCase()}`,
      note: e.note,
    })),
    ...order.refunds.map((r) => ({
      at: r.created_at,
      label: `Refund ${money(r.amount)}${r.status !== "succeeded" ? ` (${r.status})` : ""}`,
      note: r.reason,
    })),
    { at: order.created_at, label: `Placed via ${order.channel === "web" ? "web shop" : order.channel}`, note: null },
  ].sort((x, y) => y.at.localeCompare(x.at));

  return (
    <ol className="flex flex-col gap-3 text-[13px]">
      {events.map((e, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-subtle" />
          <div className="min-w-0 flex-1">
            <p className="text-ink">{e.label}</p>
            {e.note && <p className="text-subtle">{e.note}</p>}
          </div>
          <span className="shrink-0 text-subtle">{formatDateTime(e.at)}</span>
        </li>
      ))}
    </ol>
  );
}

// ── Status change: confirm, with an optional note (and tracking when shipping) ─

function StatusDialog({
  order,
  target,
  onClose,
  save,
  pending,
}: {
  order: AdminOrderDetail;
  target: OrderStatus | null;
  onClose: () => void;
  save: Save;
  pending: boolean;
}) {
  const [note, setNote] = useState("");
  const [carrier, setCarrier] = useState(order.carrier ?? "");
  const [tracking, setTracking] = useState(order.tracking_number ?? "");
  const cancelling = target === "cancelled";
  const paid = order.payment_status === "paid" || order.payment_status === "partially_refunded";

  const submit = async () => {
    if (!target) return;
    const body: Parameters<typeof adminOrders.update>[1] = { status: target, note: note.trim() || null };
    if (target === "shipped") {
      body.carrier = carrier.trim() || null;
      body.tracking_number = tracking.trim() || null;
    }
    if (await save(body, `Order ${orderStatusLabel[target].toLowerCase()}`)) {
      setNote("");
      onClose();
    }
  };

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {target && actionLabel[target]} {order.order_number}
          </DialogTitle>
          <DialogDescription>
            {cancelling
              ? `Items go back into stock and the customer sees the order as cancelled.${paid ? ` The ${formatMoney(Number(order.total) - Number(order.refunded_total))} paid is refunded automatically.` : ""}`
              : target === "delivered" && order.payment_method === "cod"
                ? "The cash payment is marked as collected."
                : "The customer sees the new status on their order page."}
          </DialogDescription>
        </DialogHeader>

        {target === "shipped" && (
          <div className="grid grid-cols-[2fr_3fr] gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ship-carrier">Carrier</Label>
              <Input id="ship-carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="DHL" maxLength={50} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ship-tracking">Tracking number</Label>
              <Input id="ship-tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Optional" className="font-mono" maxLength={100} />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="status-note">{cancelling ? "Reason" : "Note"}</Label>
          <Textarea
            id="status-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={cancelling ? "For example: out of stock" : "Optional, shown in the timeline"}
            rows={2}
            maxLength={500}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {cancelling ? "Keep order" : "Back"}
          </Button>
          <Button variant={cancelling ? "destructive" : "default"} onClick={submit} disabled={pending}>
            {pending && <Spinner />} {target && actionLabel[target]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Refund: full or partial, up to what's left ──────────────────────────────

function RefundDialog({
  order,
  open,
  onOpenChange,
  refundable,
  onDone,
}: {
  order: AdminOrderDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  refundable: number;
  onDone: () => void;
}) {
  const { run, pending } = useAdminAction();
  const [amount, setAmount] = useState(refundable.toFixed(2));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return setError("Enter an amount greater than $0.");
    if (value > refundable + 0.001) return setError(`You can refund up to ${formatMoney(refundable)}.`);
    const done = await run(
      () => adminOrders.refund(order.id, { amount: value.toFixed(2), reason: reason.trim() || null }),
      `Refunded ${formatMoney(value)}`,
    );
    if (done) {
      onOpenChange(false);
      onDone();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refund {order.order_number}</DialogTitle>
          <DialogDescription>
            {order.payment_method === "card"
              ? `Goes back to the card${order.card_last4 ? ` ending ${order.card_last4}` : ""}.`
              : "Record a cash refund you've given the customer."}{" "}
            You can refund part of the order.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="refund-amount">Amount ({order.currency})</Label>
          <Input
            id="refund-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError(null);
            }}
            aria-invalid={Boolean(error)}
            aria-describedby="refund-help"
          />
          <p id="refund-help" className={`text-[13px] ${error ? "text-danger" : "text-subtle"}`}>
            {error ?? `Up to ${formatMoney(refundable)}`}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="refund-reason">Reason</Label>
          <Textarea
            id="refund-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Optional, for example: arrived damaged"
            rows={2}
            maxLength={500}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep payment
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Spinner />} Refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Loading and not found ───────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading order">
      <Skeleton className="mb-2 h-4 w-20" />
      <Skeleton className="mb-6 h-8 w-64" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="flex flex-col items-start gap-3 p-8">
        <WarningCircle size={28} className="text-subtle" />
        <h1 className="text-xl font-semibold text-ink">Order not found</h1>
        <p className="text-[14px] text-subtle">It may have been deleted, or the link is wrong.</p>
        <Button asChild variant="outline">
          <Link href="/admin/orders">Back to orders</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

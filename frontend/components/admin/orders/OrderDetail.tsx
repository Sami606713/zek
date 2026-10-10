"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useState } from "react";
import { toast } from "sonner";
import {
  ArrowCounterClockwise,
  CheckCircle,
  DotsThree,
  EnvelopeSimple,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChannelLabel, FulfilmentBadge, PaymentBadge } from "@/components/admin/badges";
import { customerStats, getAdminOrder, getCustomer, type FulfilmentStatus } from "@/lib/admin/mock";
import { formatDateTime, formatMoney } from "@/lib/admin/format";

const flow: FulfilmentStatus[] = ["confirmed", "packed", "shipped", "delivered"];
const stepIcons = { confirmed: CheckCircle, packed: Package, shipped: Truck, delivered: MapPin };

export function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const source = getAdminOrder(id);
  const [order, setOrder] = useState(source);
  const [tracking, setTracking] = useState(source?.tracking ?? "");
  const [note, setNote] = useState("");
  const [refundOpen, setRefundOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState(source ? source.totals.total.toFixed(2) : "0");
  const [refundError, setRefundError] = useState<string | null>(null);

  if (!order) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-start gap-3 p-8">
          <WarningCircle size={28} className="text-subtle" />
          <h1 className="text-xl font-semibold text-ink">Order {id} not found</h1>
          <p className="text-[14px] text-subtle">It may have been deleted, or the link is wrong.</p>
          <Button asChild variant="outline">
            <Link href="/admin/orders">Back to orders</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const customer = getCustomer(order.customerId);
  const stats = customer ? customerStats(customer.id) : null;
  const created = new Date(order.createdAt);
  const stepIndex = flow.indexOf(order.status);

  const updateStatus = (status: FulfilmentStatus) => {
    setOrder({ ...order, status, tracking: status === "shipped" && !order.tracking ? tracking || undefined : order.tracking });
    toast.success(`Order marked as ${status}`, { description: "Customer will be notified by email and chat." });
  };

  const submitRefund = () => {
    const amount = Number(refundAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setRefundError("Enter an amount greater than $0.");
      return;
    }
    if (amount > order.totals.total) {
      setRefundError(`You can refund up to ${formatMoney(order.totals.total)}.`);
      return;
    }
    setOrder({ ...order, payment: { ...order.payment, status: "refunded" }, notes: [...order.notes, `Refunded ${formatMoney(amount)}`] });
    setRefundOpen(false);
    toast.success(`Refunded ${formatMoney(amount)}`, { description: "Arrives on the customer's card in 5 to 10 business days." });
  };

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-mono text-2xl font-semibold tracking-[-0.02em] text-ink md:text-[28px]">{order.id}</h1>
            <FulfilmentBadge status={order.status} />
            <PaymentBadge status={order.payment.status} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-subtle">
            <span>{formatDateTime(order.createdAt)}</span>
            <ChannelLabel channel={order.channel} />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {order.status !== "cancelled" && (
            <Select value={order.status} onValueChange={(v) => updateStatus(v as FulfilmentStatus)}>
              <SelectTrigger className="h-9 w-44 bg-surface" aria-label="Fulfilment status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {flow.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s[0].toUpperCase() + s.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              <DropdownMenuItem onSelect={() => toast.success("Confirmation email sent", { description: customer?.email })}>
                <EnvelopeSimple /> Resend confirmation
              </DropdownMenuItem>
              <DropdownMenuItem disabled={order.payment.status !== "paid"} onSelect={() => setRefundOpen(true)}>
                <ArrowCounterClockwise /> Refund
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={order.status === "shipped" || order.status === "delivered" || order.status === "cancelled"}
                onSelect={() => setCancelOpen(true)}
              >
                <XCircle /> Cancel order
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          {order.status !== "cancelled" ? (
            <Card>
              <CardContent className="p-5">
                <ol className="grid grid-cols-4 gap-2">
                  {flow.map((s, i) => {
                    const Icon = stepIcons[s as keyof typeof stepIcons];
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
                        <span className={`text-[12px] font-medium capitalize ${done ? "text-ink" : "text-subtle"}`}>{s}</span>
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center gap-3 p-5 text-[14px] text-ink">
                <XCircle size={20} className="text-danger" /> This order was cancelled. Stock has been returned to inventory.
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {order.lines.map((l) => (
                <div key={l.productId} className="flex items-center gap-4">
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                    <Image src={l.image} alt="" fill sizes="56px" className="object-cover" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/products/${l.productId}`} className="block truncate text-[14px] font-medium text-ink hover:underline">
                      {l.name}
                    </Link>
                    <p className="text-[13px] text-subtle">
                      {l.color ? `${l.color}, ` : ""}
                      {formatMoney(l.price)} x {l.quantity}
                    </p>
                  </div>
                  <p className="text-[14px] font-medium tabular-nums text-ink">{formatMoney(l.price * l.quantity)}</p>
                </div>
              ))}
              <Separator />
              <dl className="flex flex-col gap-2 text-[14px]">
                <div className="flex justify-between"><dt className="text-subtle">Subtotal</dt><dd className="tabular-nums">{formatMoney(order.totals.subtotal)}</dd></div>
                {order.totals.discount > 0 && (
                  <div className="flex justify-between"><dt className="text-subtle">Discount ({order.promo})</dt><dd className="tabular-nums text-brand">-{formatMoney(order.totals.discount)}</dd></div>
                )}
                <div className="flex justify-between"><dt className="text-subtle">Shipping ({order.delivery})</dt><dd className="tabular-nums">{order.totals.shipping ? formatMoney(order.totals.shipping) : "Free"}</dd></div>
                <div className="flex justify-between"><dt className="text-subtle">Tax</dt><dd className="tabular-nums">{formatMoney(order.totals.tax)}</dd></div>
                <div className="flex justify-between border-t border-line pt-3 text-[15px] font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatMoney(order.totals.total)}</dd></div>
                <div className="flex justify-between text-subtle">
                  <dt>Paid with</dt>
                  <dd>{order.payment.method === "card" ? `Card ending ${order.payment.last4}` : "Cash on delivery"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Internal notes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {order.notes.length === 0 ? (
                <p className="text-[14px] text-subtle">No notes yet. Notes are only visible to your team.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {order.notes.map((n, i) => (
                    <li key={i} className="rounded-lg bg-surface-2 px-3 py-2 text-[14px] text-ink">{n}</li>
                  ))}
                </ul>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!note.trim()) return;
                  setOrder({ ...order, notes: [...order.notes, note.trim()] });
                  setNote("");
                }}
                className="flex flex-col gap-2"
              >
                <Label htmlFor="order-note">Add a note</Label>
                <Textarea id="order-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: customer asked for gift wrap" rows={2} />
                <Button type="submit" variant="outline" className="self-end" disabled={!note.trim()}>
                  Save note
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1 text-[14px]">
              {customer && (
                <>
                  <Link href={`/admin/customers/${customer.id}`} className="font-medium text-ink hover:underline">{customer.name}</Link>
                  <a href={`mailto:${customer.email}`} className="text-brand hover:underline">{customer.email}</a>
                  <p className="text-subtle">{customer.phone}</p>
                  {stats && (
                    <p className="mt-2 text-subtle">
                      {stats.orders} orders, {formatMoney(stats.spent)} lifetime
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shipping</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-[14px]">
              {customer && (
                <address className="not-italic leading-relaxed text-ink">
                  {customer.name}
                  <br />
                  {customer.street}
                  <br />
                  {customer.city}, {customer.country}
                </address>
              )}
              <p className="text-subtle">
                {order.delivery === "express" ? "Express, 1 to 2 business days" : "Standard, 3 to 5 business days"}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setOrder({ ...order, tracking: tracking.trim() || undefined });
                  toast.success(tracking.trim() ? "Tracking number saved" : "Tracking number removed");
                }}
                className="flex flex-col gap-2"
              >
                <Label htmlFor="tracking">Tracking number</Label>
                <div className="flex gap-2">
                  <Input id="tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="1Z..." className="font-mono" />
                  <Button type="submit" variant="outline">Save</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-3 text-[13px]">
                {[
                  ...order.notes.filter((n) => n.startsWith("Refunded")).map((n) => ({ label: n, at: "Just now" })),
                  ...flow
                    .slice(0, Math.max(stepIndex, 0) + 1)
                    .reverse()
                    .map((s, i, arr) => ({
                      label: `Order ${s}`,
                      at: formatDateTime(new Date(created.getTime() + (arr.length - 1 - i) * 26 * 3600 * 1000)),
                    })),
                  { label: `Placed via ${order.channel === "web" ? "web shop" : order.channel}`, at: formatDateTime(created) },
                ].map((e, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-subtle" />
                    <span className="flex-1 text-ink">{e.label}</span>
                    <span className="text-subtle">{e.at}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund {order.id}</DialogTitle>
            <DialogDescription>
              The refund goes back to the card ending {order.payment.last4}. You can refund part of the order.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="refund-amount">Amount (USD)</Label>
            <Input
              id="refund-amount"
              inputMode="decimal"
              value={refundAmount}
              onChange={(e) => {
                setRefundAmount(e.target.value);
                setRefundError(null);
              }}
              aria-invalid={Boolean(refundError)}
              aria-describedby="refund-help"
            />
            <p id="refund-help" className={`text-[13px] ${refundError ? "text-danger" : "text-subtle"}`}>
              {refundError ?? `Up to ${formatMoney(order.totals.total)}`}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)}>Keep payment</Button>
            <Button onClick={submitRefund}>Refund</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel order {order.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              Items go back into stock and the customer gets an email. {order.payment.status === "paid" ? "The card payment is refunded in full." : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#c62f2f] text-[#fbfbfc] hover:bg-[#c62f2f]/90"
              onClick={() => {
                setOrder({ ...order, status: "cancelled", payment: { ...order.payment, status: order.payment.status === "paid" ? "refunded" : order.payment.status } });
                toast.success(`Order ${order.id} cancelled`);
              }}
            >
              Cancel order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

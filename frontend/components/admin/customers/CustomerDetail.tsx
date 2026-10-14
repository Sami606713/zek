"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { toast } from "sonner";
import {
  DotsThree,
  EnvelopeSimple,
  Key,
  LockKeyOpen,
  MapPin,
  PencilSimple,
  Phone,
  Power,
  SealCheck,
  ShieldCheck,
  ShieldSlash,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { ChannelLabel, FulfilmentBadge } from "@/components/admin/badges";
import { StatCard } from "@/components/admin/StatCard";
import { ErrorState } from "@/components/admin/states";
import { AccountBadge, displayName } from "./CustomersTable";
import { formatDate, formatMoney, formatRelative, initials } from "@/lib/admin/format";
import { errorMessage, useAdminAction, useAdminQuery } from "@/lib/admin/useAdminQuery";
import { ApiError } from "@/lib/api/client";
import { adminCustomers, adminOrders, adminUsers, type CustomerDetail as Customer } from "@/lib/api/admin";
import { useUserStore } from "@/store/userStore";

type Confirm = "deactivate" | "make-admin" | "remove-admin" | "delete";

export function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const customer = useAdminQuery(`customer:${id}`, () => adminCustomers.get(id));

  if (customer.loading) return <DetailSkeleton />;
  if (!customer.data) {
    const missing = customer.error instanceof ApiError && (customer.error.status === 404 || customer.error.status === 422);
    return missing ? <NotFound /> : <ErrorState error={customer.error} onRetry={customer.refetch} />;
  }
  return <CustomerView customer={customer.data} refetch={customer.refetch} />;
}

function CustomerView({ customer: c, refetch }: { customer: Customer; refetch: () => void }) {
  const router = useRouter();
  const me = useUserStore((s) => s.user);
  const { run, pending } = useAdminAction();
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [editing, setEditing] = useState(false);
  const orders = useAdminQuery(`customer-orders:${c.email}`, () => adminOrders.list({ q: c.email, limit: 50 }));

  const name = displayName(c);
  const isAdmin = c.role === "admin" || c.is_superuser;
  // The backend refuses these too; hiding them avoids a dead end.
  const isSelf = me?.email === c.email;
  const canChangeAccess = !isSelf && !c.is_superuser;

  const act = async (action: () => Promise<unknown>, success: string) => {
    if (await run(action, success)) refetch();
  };

  const confirmCopy: Record<Confirm, { title: string; body: string; action: string; danger?: boolean; run: () => Promise<void> }> = {
    deactivate: {
      title: `Turn off ${name}'s account?`,
      body: "They're signed out everywhere at once and can't sign in until you turn the account back on. Their orders stay.",
      action: "Turn off account",
      danger: true,
      run: () => act(() => adminCustomers.setAccess(c.id, { is_active: false }), "Account turned off"),
    },
    "make-admin": {
      title: `Make ${name} an admin?`,
      body: "They'll be able to open this admin panel and change products, orders, discounts and customers.",
      action: "Make admin",
      run: () => act(() => adminCustomers.setAccess(c.id, { role: "admin" }), `${name} is now an admin`),
    },
    "remove-admin": {
      title: `Remove admin access from ${name}?`,
      body: "They keep their customer account but can no longer open the admin panel.",
      action: "Remove admin",
      danger: true,
      run: () => act(() => adminCustomers.setAccess(c.id, { role: "customer" }), "Admin access removed"),
    },
    delete: {
      title: `Delete ${name}'s account?`,
      body: "The account is closed and hidden. Their past orders are kept for your records. This can't be undone here.",
      action: "Delete account",
      danger: true,
      run: async () => {
        if (await run(() => adminUsers.remove(c.id), "Account deleted")) router.push("/admin/customers");
      },
    },
  };
  const dialog = confirm ? confirmCopy[confirm] : null;

  return (
    <>
      <Link href="/admin/customers" className="text-[13px] text-subtle hover:text-ink">
        ← Customers
      </Link>
      <div className="mb-6 mt-1 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            <AvatarFallback className="bg-brand-soft text-[16px] font-semibold text-brand">{initials(name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-[-0.03em] text-ink md:text-[28px]">{name}</h1>
              {c.is_verified && <SealCheck size={20} weight="fill" className="text-brand" aria-label="Verified email" />}
              <AccountBadge c={c} />
              {isAdmin && <Badge className="rounded-full border-transparent bg-ink text-bg">{c.is_superuser ? "Owner" : "Admin"}</Badge>}
            </div>
            <p className="text-[14px] text-subtle">
              @{c.username}, customer since {formatDate(c.created_at)}
              {c.last_login_at && `, last signed in ${formatRelative(c.last_login_at)}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href={`mailto:${c.email}`}>
              <EnvelopeSimple /> Email
            </a>
          </Button>
          {c.is_locked && (
            <Button onClick={() => act(() => adminUsers.unlock(c.id), "Account unlocked")} disabled={pending}>
              <LockKeyOpen /> Unlock
            </Button>
          )}
          {!c.is_active && canChangeAccess && (
            <Button onClick={() => act(() => adminCustomers.setAccess(c.id, { is_active: true }), "Account turned on")} disabled={pending}>
              <Power /> Turn account on
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions" disabled={pending}>
                {pending ? <Spinner /> : <DotsThree weight="bold" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <PencilSimple /> Edit details
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => act(() => adminCustomers.sendPasswordReset(c.email), `Reset link sent to ${c.email}`)}>
                <Key /> Send password reset
              </DropdownMenuItem>
              {canChangeAccess && (
                <>
                  <DropdownMenuSeparator />
                  {c.role === "admin" ? (
                    <DropdownMenuItem onSelect={() => setConfirm("remove-admin")}>
                      <ShieldSlash /> Remove admin access
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onSelect={() => setConfirm("make-admin")}>
                      <ShieldCheck /> Make admin
                    </DropdownMenuItem>
                  )}
                  {c.is_active && (
                    <DropdownMenuItem onSelect={() => setConfirm("deactivate")}>
                      <Power /> Turn off account
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setConfirm("delete")}>
                    <Trash /> Delete account
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Orders" value={String(c.orders_count)} />
        <StatCard
          label="Total spent"
          value={formatMoney(Number(c.total_spent))}
          hint={Number(c.refunded_total) > 0 ? `after ${formatMoney(Number(c.refunded_total))} refunded` : "after refunds"}
        />
        <StatCard label="Average order" value={formatMoney(Number(c.average_order))} />
        <StatCard label="Last order" value={c.last_order_at ? formatRelative(c.last_order_at) : "Never"} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Orders</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {orders.loading ? (
              <div className="flex flex-col gap-2 px-6">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-12 rounded-lg" />
                ))}
              </div>
            ) : orders.error && !orders.data ? (
              <p className="px-6 text-[14px] text-danger">{errorMessage(orders.error)}</p>
            ) : orders.data?.items.length === 0 ? (
              <p className="px-6 text-[14px] text-subtle">No orders yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6 text-[12px]">Order</TableHead>
                    <TableHead className="text-[12px]">Channel</TableHead>
                    <TableHead className="text-[12px]">Status</TableHead>
                    <TableHead className="pr-6 text-right text-[12px]">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.data?.items.map((o) => (
                    <TableRow key={o.id} className="cursor-pointer" onClick={() => router.push(`/admin/orders/${o.id}`)}>
                      <TableCell className="pl-6">
                        <span className="block font-mono text-[13px] font-medium">{o.order_number}</span>
                        <span className="text-[12px] text-subtle">{formatDate(o.created_at)}</span>
                      </TableCell>
                      <TableCell>
                        <ChannelLabel channel={o.channel} />
                      </TableCell>
                      <TableCell>
                        <FulfilmentBadge status={o.status} />
                      </TableCell>
                      <TableCell className="pr-6 text-right text-[13px] font-medium tabular-nums">{formatMoney(Number(o.total))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-[14px]">
              <p className="flex items-center gap-2.5 break-all">
                <EnvelopeSimple size={16} className="shrink-0 text-subtle" /> {c.email}
              </p>
              <p className="flex items-center gap-2.5">
                <Phone size={16} className="shrink-0 text-subtle" /> {c.phone_number ?? <span className="text-subtle">No phone</span>}
              </p>
              <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-ink">Email {c.is_verified ? "verified" : "not verified yet"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Saved addresses</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-[14px]">
              {c.addresses.length === 0 && <p className="text-subtle">No saved addresses.</p>}
              {c.addresses.map((a) => (
                <div key={a.id} className="flex gap-2.5">
                  <MapPin size={16} className="mt-0.5 shrink-0 text-subtle" />
                  <address className="not-italic leading-relaxed text-ink">
                    <span className="font-medium">{a.label ?? a.full_name}</span>
                    {a.is_default && <span className="ml-1.5 text-[12px] text-subtle">Default</span>}
                    <br />
                    {a.line1}
                    {a.line2 && `, ${a.line2}`}
                    <br />
                    {a.city}, {a.region} {a.postal_code}, {a.country}
                  </address>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {editing && <EditDialog customer={c} onClose={() => setEditing(false)} onSaved={refetch} />}

      <AlertDialog open={Boolean(dialog)} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialog?.title}</AlertDialogTitle>
            <AlertDialogDescription>{dialog?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={dialog?.danger ? "bg-danger text-white hover:bg-danger/90" : undefined}
              onClick={() => void dialog?.run()}
            >
              {dialog?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Edit name, username, phone ──────────────────────────────────────────────

function EditDialog({ customer: c, onClose, onSaved }: { customer: Customer; onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState(c.full_name ?? "");
  const [username, setUsername] = useState(c.username);
  const [phone, setPhone] = useState(c.phone_number ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!/^[A-Za-z0-9_.-]{3,50}$/.test(username.trim())) return setError("Username: 3 to 50 letters, numbers, dots, dashes or underscores.");
    if (phone.trim() && !/^\+?[0-9 ()-]{7,20}$/.test(phone.trim())) return setError("Phone: digits, spaces, dashes, with an optional leading +.");
    setSaving(true);
    setError(null);
    try {
      await adminUsers.update(c.id, {
        full_name: fullName.trim() || null,
        username: username.trim() !== c.username ? username.trim() : null,
        phone_number: phone.trim() || null,
      });
      toast.success("Details saved");
      onSaved();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit details</DialogTitle>
          <DialogDescription>The email can only be changed by the customer.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cu-name">Full name</Label>
            <Input id="cu-name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cu-username">Username</Label>
            <Input id="cu-username" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={50} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cu-phone">Phone</Label>
            <Input id="cu-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+92 300 1234567" maxLength={20} />
          </div>
          {error && (
            <p role="alert" className="text-[13px] text-danger">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Spinner />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading customer">
      <div className="mb-6 flex items-center gap-4">
        <Skeleton className="size-14 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

function NotFound() {
  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="flex flex-col items-start gap-3 p-8">
        <WarningCircle size={28} className="text-subtle" />
        <h1 className="text-xl font-semibold text-ink">Customer not found</h1>
        <p className="text-[14px] text-subtle">The account may have been deleted, or the link is wrong.</p>
        <Button asChild variant="outline">
          <Link href="/admin/customers">Back to customers</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

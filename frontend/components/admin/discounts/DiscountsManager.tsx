"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Copy, DotsThree, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/admin/DataTable";
import { PageHeader } from "@/components/admin/PageHeader";
import { ErrorState, TableSkeleton } from "@/components/admin/states";
import { formatDate, formatMoney } from "@/lib/admin/format";
import { errorMessage, useAdminAction, useAdminQuery } from "@/lib/admin/useAdminQuery";
import { ApiError } from "@/lib/api/client";
import {
  adminDiscounts,
  type AdminDiscountDetail,
  type AdminDiscountRow,
  type DiscountCreate,
  type DiscountListQuery,
} from "@/lib/api/admin";

const PAGE_SIZE = 20;
type Status = AdminDiscountRow["status"];
type Tab = "all" | Status;
const tabs: { value: Tab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Live" },
  { value: "scheduled", label: "Scheduled" },
  { value: "inactive", label: "Paused" },
  { value: "used_up", label: "Used up" },
  { value: "expired", label: "Expired" },
];
const statusLabel: Record<Status, string> = {
  active: "Live",
  scheduled: "Scheduled",
  inactive: "Paused",
  used_up: "Used up",
  expired: "Expired",
};

const offer = (d: Pick<AdminDiscountRow, "type" | "value">) =>
  d.type === "percent" ? `${Number(d.value)}% off` : `${formatMoney(Number(d.value))} off`;

function StatusBadge({ status }: { status: Status }) {
  const tone =
    status === "active" ? "bg-brand-soft text-brand" : status === "scheduled" ? "bg-ink text-bg" : "bg-surface-2 text-subtle";
  return <Badge className={`rounded-full border-transparent ${tone}`}>{statusLabel[status]}</Badge>;
}

// ── Dates: the form uses local calendar days, the API full timestamps ──────

const toDay = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
/** Start of the day for starts, end of the day for ends, in the admin's time zone. */
const fromDay = (day: string, end = false) => (day ? new Date(`${day}T${end ? "23:59:59" : "00:00:00"}`).toISOString() : null);

// ── Form ────────────────────────────────────────────────────────────────────

const amount = /^\d{1,8}(\.\d{1,2})?$/;
const schema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, "Use at least 3 characters.")
      .max(40, "Up to 40 characters.")
      .regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, - and _ only. No spaces."),
    description: z.string().trim().max(200, "Up to 200 characters."),
    type: z.enum(["percent", "fixed"]),
    value: z.string().trim().regex(amount, "Enter a number like 10 or 12.50."),
    minOrder: z.union([z.literal(""), z.string().trim().regex(amount, "Enter an amount like 50.")]),
    usageLimit: z.union([z.literal(""), z.string().trim().regex(/^[1-9]\d{0,6}$/, "Whole number, 1 or more.")]),
    perCustomer: z.union([z.literal(""), z.string().trim().regex(/^[1-9]\d{0,6}$/, "Whole number, 1 or more.")]),
    startsAt: z.string(),
    endsAt: z.string(),
    isActive: z.boolean(),
  })
  .refine((v) => Number(v.value) > 0, { path: ["value"], message: "Must be more than 0." })
  .refine((v) => v.type !== "percent" || Number(v.value) <= 100, { path: ["value"], message: "A percent discount can't be over 100%." })
  .refine((v) => !v.startsAt || !v.endsAt || v.endsAt >= v.startsAt, { path: ["endsAt"], message: "Must be on or after the start date." })
  .refine((v) => !v.minOrder || Number(v.minOrder) > 0, { path: ["minOrder"], message: "Leave empty for no minimum." });

type Values = z.infer<typeof schema>;

const emptyValues: Values = {
  code: "", description: "", type: "percent", value: "10", minOrder: "", usageLimit: "", perCustomer: "",
  startsAt: "", endsAt: "", isActive: true,
};

const toValues = (d: AdminDiscountDetail): Values => ({
  code: d.code,
  description: d.description ?? "",
  type: d.type,
  value: String(Number(d.value)),
  minOrder: d.min_order_amount ? String(Number(d.min_order_amount)) : "",
  usageLimit: d.usage_limit ? String(d.usage_limit) : "",
  perCustomer: d.per_customer_limit ? String(d.per_customer_limit) : "",
  startsAt: toDay(d.starts_at),
  endsAt: toDay(d.ends_at),
  isActive: d.is_active,
});

const toBody = (v: Values): DiscountCreate => ({
  code: v.code.trim().toUpperCase(),
  description: v.description.trim() || null,
  type: v.type,
  value: v.value,
  min_order_amount: v.minOrder || null,
  usage_limit: v.usageLimit ? Number(v.usageLimit) : null,
  per_customer_limit: v.perCustomer ? Number(v.perCustomer) : null,
  starts_at: fromDay(v.startsAt),
  ends_at: fromDay(v.endsAt, true),
  is_active: v.isActive,
});

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-[13px] text-danger">
      {message}
    </p>
  ) : null;
}

// ── Page ────────────────────────────────────────────────────────────────────

export function DiscountsManager() {
  const [tab, setTab] = useState<Tab>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [editor, setEditor] = useState<{ id: string | null } | null>(null);
  const [deleting, setDeleting] = useState<AdminDiscountRow | null>(null);
  const { run, pending } = useAdminAction();

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const query: DiscountListQuery = {
    status: tab === "all" ? undefined : tab,
    search: search || undefined,
    skip: page * PAGE_SIZE,
    limit: PAGE_SIZE,
  };
  const list = useAdminQuery(JSON.stringify(query), () => adminDiscounts.list(query));
  const counts = useAdminQuery(`counts:${search}`, async () => {
    const totals = await Promise.all(
      tabs.map((t) =>
        adminDiscounts.list({ status: t.value === "all" ? undefined : t.value, search: search || undefined, limit: 1 }).then((r) => r.total),
      ),
    );
    return Object.fromEntries(tabs.map((t, i) => [t.value, totals[i]])) as Record<Tab, number>;
  });
  const reload = () => {
    list.refetch();
    counts.refetch();
  };

  const toggle = async (d: AdminDiscountRow, on: boolean) => {
    if (await run(() => adminDiscounts.update(d.id, { is_active: on }), `${d.code} ${on ? "turned on" : "paused"}`)) reload();
  };

  const remove = async (d: AdminDiscountRow) => {
    try {
      await adminDiscounts.remove(d.id);
      toast.success(`Deleted ${d.code}`);
      reload();
    } catch (e) {
      // Used codes can't be deleted; offer the safe alternative.
      if (e instanceof ApiError && e.status === 409) {
        toast.error(`${d.code} has been used on orders`, {
          description: "Pause it instead to keep the order history.",
          action: d.is_active ? { label: "Pause", onClick: () => void toggle(d, false) } : undefined,
        });
      } else {
        toast.error(errorMessage(e));
      }
    }
  };

  const columns: ColumnDef<AdminDiscountRow, unknown>[] = [
    {
      accessorKey: "code",
      header: "Code",
      cell: ({ row }) => (
        <div className="min-w-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void navigator.clipboard?.writeText(row.original.code);
              toast.success(`Copied ${row.original.code}`);
            }}
            className="inline-flex items-center gap-1.5 rounded-md font-mono font-semibold text-ink hover:text-brand"
            aria-label={`Copy ${row.original.code}`}
          >
            {row.original.code} <Copy size={13} className="text-subtle" />
          </button>
          {row.original.description && <p className="max-w-56 truncate text-[12px] text-subtle">{row.original.description}</p>}
        </div>
      ),
    },
    { id: "offer", header: "Offer", cell: ({ row }) => <span className="whitespace-nowrap">{offer(row.original)}</span> },
    {
      id: "minimum",
      header: "Minimum",
      cell: ({ row }) =>
        row.original.min_order_amount ? formatMoney(Number(row.original.min_order_amount)) : <span className="text-subtle">None</span>,
    },
    {
      id: "usage",
      header: "Used",
      cell: ({ row }) => (
        <span className="whitespace-nowrap tabular-nums">
          {row.original.used_count}
          <span className="text-subtle"> / {row.original.usage_limit ?? "no limit"}</span>
          {row.original.per_customer_limit && (
            <span className="block text-[12px] text-subtle">{row.original.per_customer_limit} per customer</span>
          )}
        </span>
      ),
    },
    {
      id: "dates",
      header: "Runs",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-subtle">
          {row.original.starts_at ? formatDate(row.original.starts_at) : "Now"} to{" "}
          {row.original.ends_at ? formatDate(row.original.ends_at) : "no end"}
        </span>
      ),
    },
    { id: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      id: "active",
      header: "On",
      cell: ({ row }) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={row.original.is_active}
            disabled={pending}
            aria-label={`Turn ${row.original.code} ${row.original.is_active ? "off" : "on"}`}
            onCheckedChange={(v) => void toggle(row.original, v)}
          />
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <span onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.original.code}`}>
                <DotsThree weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditor({ id: row.original.id })}>
                <PencilSimple /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(row.original)}>
                <Trash /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Discounts"
        description="Promo codes customers, and the agent, can use at checkout."
        actions={
          <Button onClick={() => setEditor({ id: null })}>
            <Plus /> Create discount
          </Button>
        }
      />

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as Tab);
          setPage(0);
        }}
        className="mb-4"
      >
        <TabsList className="h-auto flex-wrap">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
              {t.label}
              {counts.data && <span className="text-[11px] tabular-nums text-subtle">{counts.data[t.value]}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {list.loading ? (
        <TableSkeleton columns={6} />
      ) : list.error && !list.data ? (
        <ErrorState error={list.error} onRetry={list.refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={list.data?.items ?? []}
          getRowId={(d) => d.id}
          pageSize={PAGE_SIZE}
          server={{ total: list.data?.total ?? 0, pageIndex: page, onPageChange: setPage }}
          search={{ value: searchInput, onChange: setSearchInput }}
          busy={list.refreshing || pending}
          searchPlaceholder="Search codes"
          onRowClick={(d) => setEditor({ id: d.id })}
          emptyText={search || tab !== "all" ? "No codes match." : "No discount codes yet. Create your first one."}
        />
      )}

      {editor && (
        <DiscountDialog
          id={editor.id}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            reload();
          }}
        />
      )}

      <AlertDialog open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              Customers can&apos;t use it any more. Codes already used on orders can&apos;t be deleted; pause those instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep code</AlertDialogCancel>
            <AlertDialogAction className="bg-danger text-white hover:bg-danger/90" onClick={() => deleting && void remove(deleting)}>
              Delete code
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Create / edit dialog (edit loads the code's stats too) ──────────────────

function DiscountDialog({ id, onClose, onSaved }: { id: string | null; onClose: () => void; onSaved: () => void }) {
  const detail = useAdminQuery(`discount:${id}`, () => (id ? adminDiscounts.get(id) : Promise.resolve(null)));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{id ? `Edit ${detail.data?.code ?? "discount"}` : "Create discount"}</DialogTitle>
          <DialogDescription>Customers type the code at checkout. The agent can apply it too.</DialogDescription>
        </DialogHeader>
        {id && detail.loading ? (
          <div className="grid h-64 place-items-center text-subtle">
            <Spinner />
          </div>
        ) : id && !detail.data ? (
          <ErrorState error={detail.error} onRetry={detail.refetch} />
        ) : (
          <DiscountForm detail={detail.data ?? null} onClose={onClose} onSaved={onSaved} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DiscountForm({
  detail,
  onClose,
  onSaved,
}: {
  detail: AdminDiscountDetail | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: detail ? toValues(detail) : emptyValues });
  const { register, control, handleSubmit, watch, setError, formState } = form;
  const { errors, isSubmitting } = formState;
  // eslint-disable-next-line react-hooks/incompatible-library -- RHF watch drives the value label
  const type = watch("type");

  const onSubmit = async (v: Values) => {
    try {
      if (detail) await adminDiscounts.update(detail.id, toBody(v));
      else await adminDiscounts.create(toBody(v));
      toast.success(detail ? `Saved ${v.code.toUpperCase()}` : `Created ${v.code.toUpperCase()}`);
      onSaved();
    } catch (e) {
      const message = errorMessage(e);
      if (e instanceof ApiError && e.status === 409) setError("code", { message });
      else if (/usage_limit/.test(message)) setError("usageLimit", { message: message.replace("usage_limit", "Usage limit") });
      else toast.error(message);
    }
  };

  return (
    <>
      {detail && (
        <dl className="grid grid-cols-3 gap-2 rounded-xl bg-surface-2 p-3 text-center">
          <Stat label="Orders" value={String(detail.orders_count)} />
          <Stat label="Discount given" value={formatMoney(Number(detail.total_discounted))} />
          <Stat label="Revenue" value={formatMoney(Number(detail.revenue))} />
        </dl>
      )}
      <form id="discount-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid grid-cols-2 gap-4">
        <div className="col-span-2 flex flex-col gap-2">
          <Label htmlFor="d-code">Code</Label>
          <Input id="d-code" className="font-mono uppercase" aria-invalid={Boolean(errors.code)} {...register("code")} placeholder="SUMMER15" />
          <FieldError message={errors.code?.message} />
        </div>
        <div className="col-span-2 flex flex-col gap-2">
          <Label htmlFor="d-desc">
            Description <span className="font-normal text-subtle">(optional, shown at checkout)</span>
          </Label>
          <Input id="d-desc" aria-invalid={Boolean(errors.description)} {...register("description")} placeholder="15% off summer styles" />
          <FieldError message={errors.description?.message} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="d-type">Type</Label>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="d-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percent off</SelectItem>
                  <SelectItem value="fixed">Fixed amount off</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="d-value">{type === "percent" ? "Percent" : "Amount (USD)"}</Label>
          <Input id="d-value" inputMode="decimal" aria-invalid={Boolean(errors.value)} {...register("value")} />
          <FieldError message={errors.value?.message} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="d-min">
            Minimum order <span className="font-normal text-subtle">(USD)</span>
          </Label>
          <Input id="d-min" inputMode="decimal" aria-invalid={Boolean(errors.minOrder)} {...register("minOrder")} placeholder="None" />
          <FieldError message={errors.minOrder?.message} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="d-limit">Total uses</Label>
          <Input id="d-limit" inputMode="numeric" aria-invalid={Boolean(errors.usageLimit)} {...register("usageLimit")} placeholder="No limit" />
          <FieldError message={errors.usageLimit?.message} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="d-per">Uses per customer</Label>
          <Input id="d-per" inputMode="numeric" aria-invalid={Boolean(errors.perCustomer)} {...register("perCustomer")} placeholder="No limit" />
          <FieldError message={errors.perCustomer?.message} />
        </div>
        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <label className="flex items-center justify-between gap-3 self-end rounded-lg border border-line px-3 py-2 text-[14px] text-ink">
              Turned on
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </label>
          )}
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor="d-start">
            Starts <span className="font-normal text-subtle">(optional)</span>
          </Label>
          <Input id="d-start" type="date" aria-invalid={Boolean(errors.startsAt)} {...register("startsAt")} />
          <FieldError message={errors.startsAt?.message} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="d-end">
            Ends <span className="font-normal text-subtle">(optional)</span>
          </Label>
          <Input id="d-end" type="date" aria-invalid={Boolean(errors.endsAt)} {...register("endsAt")} />
          <FieldError message={errors.endsAt?.message} />
        </div>
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" form="discount-form" disabled={isSubmitting}>
          {isSubmitting && <Spinner />} {detail ? "Save discount" : "Create discount"}
        </Button>
      </DialogFooter>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-subtle">{label}</dt>
      <dd className="text-[15px] font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}

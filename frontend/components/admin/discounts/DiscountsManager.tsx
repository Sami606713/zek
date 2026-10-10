"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Copy, Plus } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/admin/DataTable";
import { PageHeader } from "@/components/admin/PageHeader";
import { discounts as seed, TODAY, type Discount } from "@/lib/admin/mock";
import { formatDate, formatMoney } from "@/lib/admin/format";

const describe = (d: Discount) =>
  d.type === "percent" ? `${d.value}% off` : d.type === "fixed" ? `${formatMoney(d.value)} off` : "Free shipping";

function state(d: Discount) {
  const today = TODAY.toISOString().slice(0, 10);
  if (!d.active) return "paused";
  if (d.startsAt > today) return "scheduled";
  if ((d.endsAt && d.endsAt < today) || (d.usageLimit !== null && d.used >= d.usageLimit)) return "expired";
  return "live";
}

const schema = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,20}$/, "Use 3 to 20 letters or numbers, no spaces."),
    type: z.enum(["percent", "fixed", "shipping"]),
    value: z.coerce.number<string>().min(0),
    minOrder: z.coerce.number<string>().min(0, "Can't be negative."),
    usageLimit: z.union([z.literal(""), z.coerce.number<string>().int().positive("Must be at least 1.")]),
    startsAt: z.string().min(1, "Pick a start date."),
    endsAt: z.string(),
  })
  .refine((v) => v.type === "shipping" || v.value > 0, { path: ["value"], message: "Enter a value above 0." })
  .refine((v) => v.type !== "percent" || v.value <= 90, { path: ["value"], message: "Percent discounts max out at 90%." })
  .refine((v) => !v.endsAt || v.endsAt >= v.startsAt, { path: ["endsAt"], message: "End date must be after the start." });

type In = z.input<typeof schema>;
type Out = z.output<typeof schema>;

export function DiscountsManager() {
  const [items, setItems] = useState(seed);
  const [open, setOpen] = useState(false);
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(schema),
    defaultValues: { code: "", type: "percent", value: "10", minOrder: "0", usageLimit: "", startsAt: "2026-10-10", endsAt: "" },
  });
  const { register, control, handleSubmit, watch, reset, setError, formState: { errors } } = form;
  // eslint-disable-next-line react-hooks/incompatible-library -- RHF watch toggles the value field
  const type = watch("type");

  const onSubmit = (v: Out) => {
    if (items.some((d) => d.code === v.code)) {
      setError("code", { message: `${v.code} already exists.` });
      return;
    }
    setItems((prev) => [
      { code: v.code, type: v.type, value: v.type === "shipping" ? 0 : v.value, minOrder: v.minOrder, startsAt: v.startsAt, endsAt: v.endsAt || null, usageLimit: v.usageLimit === "" ? null : v.usageLimit, used: 0, active: true },
      ...prev,
    ]);
    toast.success(`Created ${v.code}`, { description: "Demo mode: checkout still accepts ZEK10 only." });
    setOpen(false);
    reset();
  };

  const columns: ColumnDef<Discount, unknown>[] = [
    {
      accessorKey: "code",
      header: "Code",
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(row.original.code);
            toast.success(`Copied ${row.original.code}`);
          }}
          className="inline-flex items-center gap-1.5 rounded-md font-mono font-semibold text-ink hover:text-brand"
        >
          {row.original.code} <Copy size={13} className="text-subtle" />
        </button>
      ),
    },
    { id: "offer", header: "Offer", cell: ({ row }) => describe(row.original) },
    {
      accessorKey: "minOrder",
      header: "Minimum",
      cell: ({ row }) => (row.original.minOrder ? formatMoney(row.original.minOrder) : <span className="text-subtle">None</span>),
    },
    {
      id: "usage",
      header: "Used",
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.used}
          <span className="text-subtle"> / {row.original.usageLimit ?? "no limit"}</span>
        </span>
      ),
    },
    {
      id: "dates",
      header: "Runs",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-subtle">
          {formatDate(row.original.startsAt)} to {row.original.endsAt ? formatDate(row.original.endsAt) : "no end"}
        </span>
      ),
    },
    {
      id: "state",
      header: "Status",
      cell: ({ row }) => {
        const s = state(row.original);
        const tone = s === "live" ? "bg-brand-soft text-brand" : s === "scheduled" ? "bg-ink text-bg" : "bg-surface-2 text-subtle";
        return <Badge className={`rounded-full border-transparent capitalize ${tone}`}>{s}</Badge>;
      },
    },
    {
      id: "active",
      header: "On",
      cell: ({ row }) => (
        <Switch
          checked={row.original.active}
          aria-label={`Turn ${row.original.code} ${row.original.active ? "off" : "on"}`}
          onCheckedChange={(v) => {
            setItems((prev) => prev.map((d) => (d.code === row.original.code ? { ...d, active: v } : d)));
            toast.success(`${row.original.code} ${v ? "turned on" : "paused"}`);
          }}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Discounts"
        description="Promo codes customers can use at checkout."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus /> Create discount
          </Button>
        }
      />

      <DataTable columns={columns} data={items} getRowId={(d) => d.code} searchPlaceholder="Search codes" globalFilterFn={(d, q) => d.code.toLowerCase().includes(q)} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create discount</DialogTitle>
            <DialogDescription>Customers type the code at checkout.</DialogDescription>
          </DialogHeader>
          <form id="discount-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid grid-cols-2 gap-4">
            <div className="col-span-2 flex flex-col gap-2">
              <Label htmlFor="d-code">Code</Label>
              <Input id="d-code" className="font-mono uppercase" aria-invalid={Boolean(errors.code)} {...register("code")} placeholder="SUMMER15" />
              {errors.code && <p role="alert" className="text-[13px] text-danger">{errors.code.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="d-type">Type</Label>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="d-type" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percent off</SelectItem>
                      <SelectItem value="fixed">Fixed amount off</SelectItem>
                      <SelectItem value="shipping">Free shipping</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="d-value">{type === "percent" ? "Percent" : "Amount (USD)"}</Label>
              <Input id="d-value" inputMode="decimal" disabled={type === "shipping"} aria-invalid={Boolean(errors.value)} {...register("value")} />
              {errors.value && <p role="alert" className="text-[13px] text-danger">{errors.value.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="d-min">Minimum order (USD)</Label>
              <Input id="d-min" inputMode="decimal" aria-invalid={Boolean(errors.minOrder)} {...register("minOrder")} />
              {errors.minOrder && <p role="alert" className="text-[13px] text-danger">{errors.minOrder.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="d-limit">Usage limit <span className="font-normal text-subtle">(optional)</span></Label>
              <Input id="d-limit" inputMode="numeric" aria-invalid={Boolean(errors.usageLimit)} {...register("usageLimit")} placeholder="No limit" />
              {errors.usageLimit && <p role="alert" className="text-[13px] text-danger">{errors.usageLimit.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="d-start">Starts</Label>
              <Input id="d-start" type="date" aria-invalid={Boolean(errors.startsAt)} {...register("startsAt")} />
              {errors.startsAt && <p role="alert" className="text-[13px] text-danger">{errors.startsAt.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="d-end">Ends <span className="font-normal text-subtle">(optional)</span></Label>
              <Input id="d-end" type="date" aria-invalid={Boolean(errors.endsAt)} {...register("endsAt")} />
              {errors.endsAt && <p role="alert" className="text-[13px] text-danger">{errors.endsAt.message}</p>}
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" form="discount-form">Create discount</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

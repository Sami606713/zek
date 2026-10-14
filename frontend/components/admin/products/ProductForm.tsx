"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Archive, ArrowSquareOut, Plus, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ProductCard } from "@/components/shop/ProductCard";
import { ProductStatusBadge } from "@/components/admin/badges";
import { ProductImages, uploadPending, type PendingImage } from "./ProductImages";
import type { CategorySlug } from "@/lib/catalog";
import { errorMessage, useAdminAction, useAdminQuery } from "@/lib/admin/useAdminQuery";
import {
  adminCategories,
  adminProducts,
  type AdminProductDetail,
  type ProductCreate,
  type ProductUpdate,
  type VariantCreate,
} from "@/lib/api/admin";

// ── Validation (mirrors the API's limits so errors show before saving) ─────

const money = /^\d{1,8}(\.\d{1,2})?$/;
const moneyMsg = "Enter an amount like 49.99";

const variantSchema = z.object({
  id: z.string().optional(),
  colorName: z.string().trim().max(50, "Up to 50 characters."),
  colorHex: z.union([z.literal(""), z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex like #1d1e22.")]),
  size: z.string().trim().max(20, "Up to 20 characters."),
  sku: z.union([
    z.literal(""),
    z.string().trim().max(64).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "Letters, numbers, dots, dashes, underscores."),
  ]),
  price: z.union([z.literal(""), z.string().trim().regex(money, moneyMsg)]),
  stock: z.string().trim().regex(/^\d{1,7}$/, "Whole number, 0 or more."),
  isActive: z.boolean(),
});

const schema = z
  .object({
    name: z.string().trim().min(2, "Use at least 2 characters.").max(200, "Up to 200 characters."),
    slug: z.union([
      z.literal(""),
      z.string().trim().max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and single dashes."),
    ]),
    brand: z.string().trim().max(100, "Up to 100 characters."),
    categoryId: z.string(),
    description: z.string().trim().max(5000, "Up to 5,000 characters."),
    status: z.enum(["active", "draft", "archived"]),
    isFeatured: z.boolean(),
    price: z.string().trim().regex(money, moneyMsg),
    compareAt: z.union([z.literal(""), z.string().trim().regex(money, moneyMsg)]),
    lowStockThreshold: z.string().trim().regex(/^\d{1,5}$/, "Whole number, 0 or more."),
    details: z.array(z.object({ value: z.string().trim().min(1, "Remove empty lines.").max(200, "Up to 200 characters.") })),
    tags: z.string(),
    seoTitle: z.string().trim().max(200, "Up to 200 characters."),
    seoDescription: z.string().trim().max(320, "Up to 320 characters."),
    variants: z.array(variantSchema).min(1, "A product needs at least one variant."),
  })
  .superRefine((v, ctx) => {
    if (v.compareAt && Number(v.compareAt) <= Number(v.price)) {
      ctx.addIssue({ code: "custom", path: ["compareAt"], message: "Should be higher than the price, to show a sale." });
    }
    if (splitTags(v.tags).some((t) => t.length > 50)) {
      ctx.addIssue({ code: "custom", path: ["tags"], message: "Each tag can be up to 50 characters." });
    }
    const options = new Map<string, number>();
    const skus = new Map<string, number>();
    v.variants.forEach((variant, i) => {
      const option = `${variant.colorName.trim().toLowerCase()}|${variant.size.trim().toLowerCase()}`;
      if (options.has(option)) {
        ctx.addIssue({ code: "custom", path: ["variants", i, "size"], message: "Same color and size as another variant." });
      }
      options.set(option, i);
      const sku = variant.sku.trim().toUpperCase();
      if (sku && skus.has(sku)) ctx.addIssue({ code: "custom", path: ["variants", i, "sku"], message: "SKU already used above." });
      if (sku) skus.set(sku, i);
    });
  });

type Values = z.infer<typeof schema>;
type VariantValues = z.infer<typeof variantSchema>;

const splitTags = (s: string) =>
  s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

const emptyVariant: VariantValues = { colorName: "", colorHex: "", size: "", sku: "", price: "", stock: "0", isActive: true };

function toValues(p?: AdminProductDetail): Values {
  if (!p) {
    return {
      name: "", slug: "", brand: "", categoryId: "", description: "", status: "draft", isFeatured: false,
      price: "", compareAt: "", lowStockThreshold: "5", details: [], tags: "", seoTitle: "", seoDescription: "",
      variants: [emptyVariant],
    };
  }
  return {
    name: p.name,
    slug: p.slug,
    brand: p.brand ?? "",
    categoryId: p.category?.id ?? "",
    description: p.description ?? "",
    status: p.status,
    isFeatured: p.is_featured,
    price: Number(p.price).toFixed(2),
    compareAt: p.compare_at_price ? Number(p.compare_at_price).toFixed(2) : "",
    lowStockThreshold: String(p.low_stock_threshold),
    details: p.details.map((value) => ({ value })),
    tags: p.tags.join(", "),
    seoTitle: p.seo_title ?? "",
    seoDescription: p.seo_description ?? "",
    variants: p.variants.map((v) => ({
      id: v.id,
      colorName: v.color_name ?? "",
      colorHex: v.color_hex ?? "",
      size: v.size ?? "",
      sku: v.sku,
      price: v.price ? Number(v.price).toFixed(2) : "",
      stock: String(v.stock_qty),
      isActive: v.is_active,
    })),
  };
}

const orNull = (s: string) => (s.trim() ? s.trim() : null);

function variantBody(v: VariantValues, position: number): Omit<VariantCreate, "stock_qty"> {
  return {
    position,
    color_name: orNull(v.colorName),
    color_hex: v.colorName.trim() ? orNull(v.colorHex) : null,
    size: orNull(v.size),
    price: orNull(v.price),
    is_active: v.isActive,
  };
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-[13px] text-danger">
      {message}
    </p>
  );
}

// ── Form ────────────────────────────────────────────────────────────────────

type Props =
  | { product?: undefined; onSaved?: undefined; onImagesChange?: undefined }
  | { product: AdminProductDetail; onSaved: () => void; onImagesChange: () => void };

export function ProductForm({ product, onSaved, onImagesChange }: Props) {
  const router = useRouter();
  const editing = Boolean(product);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const { run, pending: acting } = useAdminAction();
  const categories = useAdminQuery("categories", () => adminCategories.list({ limit: 100 }));

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(product) });
  const { register, control, handleSubmit, watch, formState } = form;
  const { errors, isDirty, isSubmitting } = formState;
  const details = useFieldArray({ control, name: "details" });
  const variants = useFieldArray({ control, name: "variants" });

  // eslint-disable-next-line react-hooks/incompatible-library -- RHF watch drives the live preview
  const values = watch();
  const totalStock = values.variants.reduce((n, v) => n + (Number(v.stock) || 0), 0);
  const categorySlug = categories.data?.items.find((c) => c.id === values.categoryId)?.slug ?? "tech";
  const previewImages =
    product?.images.map((i) => i.url) ?? pendingImages.map((i) => i.preview);
  const preview = {
    id: product?.slug ?? "preview",
    name: values.name || "Product name",
    brand: values.brand || "Brand",
    category: categorySlug as CategorySlug,
    price: Number(values.price) || 0,
    compareAt: values.compareAt ? Number(values.compareAt) : undefined,
    image: previewImages[0] ?? "https://picsum.photos/id/1/800/1000",
    gallery: previewImages,
    rating: product?.rating_avg ?? 0,
    reviews: product?.review_count ?? 0,
    stock: totalStock,
    addedOn: product?.created_at ?? new Date().toISOString(),
    description: values.description,
    details: [],
  };

  const productBody = (v: Values) => ({
    name: v.name.trim(),
    brand: orNull(v.brand),
    category_id: v.categoryId || null,
    description: orNull(v.description),
    details: v.details.map((d) => d.value.trim()),
    tags: splitTags(v.tags),
    price: v.price,
    compare_at_price: orNull(v.compareAt),
    status: v.status,
    is_featured: v.isFeatured,
    low_stock_threshold: Number(v.lowStockThreshold),
    seo_title: orNull(v.seoTitle),
    seo_description: orNull(v.seoDescription),
  });

  const create = async (v: Values) => {
    const body: ProductCreate = {
      ...productBody(v),
      slug: orNull(v.slug),
      currency: "USD",
      variants: v.variants.map((variant, i) => ({
        ...variantBody(variant, i),
        sku: orNull(variant.sku),
        stock_qty: Number(variant.stock),
      })),
    };
    let created: AdminProductDetail;
    try {
      created = await adminProducts.create(body);
    } catch (e) {
      toast.error(errorMessage(e));
      return;
    }
    const { failed, error } = await uploadPending(created.id, pendingImages);
    if (failed) {
      toast.warning(`Created ${created.name}, but ${failed} ${failed === 1 ? "image" : "images"} didn't upload`, {
        description: errorMessage(error),
      });
    } else {
      toast.success(`Created ${created.name}`);
    }
    router.replace(`/admin/products/${created.id}`);
  };

  /** Product fields first, then variants: add, update, stock, and remove last (a product keeps at least one). */
  const update = async (p: AdminProductDetail, v: Values) => {
    const original = new Map(p.variants.map((x) => [x.id, x]));
    const keptIds = new Set(v.variants.map((x) => x.id).filter(Boolean));
    try {
      const body: ProductUpdate = productBody(v);
      if (v.slug && v.slug !== p.slug) body.slug = v.slug;
      await adminProducts.update(p.id, body);

      for (const [i, variant] of v.variants.entries()) {
        if (!variant.id) {
          await adminProducts.addVariant(p.id, { ...variantBody(variant, i), sku: orNull(variant.sku), stock_qty: Number(variant.stock) });
          continue;
        }
        const before = original.get(variant.id)!;
        const meta = variantBody(variant, i);
        const skuChanged = variant.sku.trim() && variant.sku.trim().toUpperCase() !== before.sku.toUpperCase();
        const metaChanged =
          meta.color_name !== before.color_name ||
          meta.color_hex !== before.color_hex ||
          meta.size !== before.size ||
          (meta.price === null ? before.price !== null : Number(meta.price) !== Number(before.price)) ||
          meta.is_active !== before.is_active ||
          meta.position !== before.position ||
          skuChanged;
        if (metaChanged) {
          await adminProducts.updateVariant(p.id, variant.id, { ...meta, ...(skuChanged ? { sku: variant.sku.trim() } : {}) });
        }
        if (Number(variant.stock) !== before.stock_qty) {
          await adminProducts.adjustStock(p.id, variant.id, { set_to: Number(variant.stock), reason: "Edited on the product page" });
        }
      }
      for (const id of original.keys()) {
        if (!keptIds.has(id)) await adminProducts.removeVariant(p.id, id);
      }
      toast.success(`Saved ${v.name}`);
    } catch (e) {
      toast.error(errorMessage(e), { description: "Some changes may have saved. The form now shows what's stored." });
    }
    onSaved?.();
  };

  const onSubmit = (v: Values) => (product ? update(product, v) : create(v));

  const archive = async () => {
    if (!product) return;
    if (await run(() => adminProducts.update(product.id, { status: "archived" }), `${product.name} archived`)) onSaved?.();
  };

  const remove = async () => {
    if (!product) return;
    if (await run(() => adminProducts.remove(product.id), `${product.name} deleted`)) router.push("/admin/products");
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link href="/admin/products" className="text-[13px] text-subtle hover:text-ink">
            ← Products
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h1 className="truncate text-2xl font-semibold tracking-[-0.03em] text-ink md:text-[28px]">
              {product ? product.name : "New product"}
            </h1>
            {product && <ProductStatusBadge status={product.status} />}
          </div>
          <p className="mt-1 text-[14px] text-subtle">
            {product
              ? "Saving updates the store and the agent's product search."
              : "Drafts are hidden from the store until you set them to Active."}
          </p>
        </div>
        {product?.status === "active" && (
          <Button variant="outline" asChild>
            <Link href={`/products/${product.slug}`} target="_blank">
              <ArrowSquareOut /> View in store
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>General</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" aria-invalid={Boolean(errors.name)} {...register("name")} placeholder="Vela 35 Film Camera" />
                <FieldError message={errors.name?.message} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="brand">Brand</Label>
                <Input id="brand" aria-invalid={Boolean(errors.brand)} {...register("brand")} />
                <FieldError message={errors.brand?.message} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="category">Category</Label>
                <Controller
                  control={control}
                  name="categoryId"
                  render={({ field }) => (
                    <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                      <SelectTrigger id="category" className="w-full">
                        <SelectValue placeholder={categories.loading ? "Loading…" : "Choose"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No category</SelectItem>
                        {categories.data?.items.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" rows={5} aria-invalid={Boolean(errors.description)} aria-describedby="description-hint" {...register("description")} />
                {errors.description ? (
                  <FieldError message={errors.description.message} />
                ) : (
                  <p id="description-hint" className="text-[13px] text-subtle">
                    {values.description?.length ?? 0}/5,000. The agent reads this when answering questions.
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="tags">Tags</Label>
                <Input id="tags" aria-invalid={Boolean(errors.tags)} {...register("tags")} placeholder="gift, wireless, travel" />
                {errors.tags ? <FieldError message={errors.tags.message} /> : <p className="text-[13px] text-subtle">Comma separated. Helps search.</p>}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="slug">URL slug</Label>
                <Input id="slug" aria-invalid={Boolean(errors.slug)} {...register("slug")} placeholder="Made from the name" className="font-mono" />
                {errors.slug ? <FieldError message={errors.slug.message} /> : <p className="text-[13px] text-subtle">/products/{values.slug || "…"}</p>}
              </div>
            </CardContent>
          </Card>

          {product ? (
            <ProductImages mode="edit" productId={product.id} images={product.images} onChange={onImagesChange!} />
          ) : (
            <ProductImages mode="create" pending={pendingImages} onPendingChange={setPendingImages} />
          )}

          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="price">Price (USD)</Label>
                <Input id="price" inputMode="decimal" aria-invalid={Boolean(errors.price)} {...register("price")} placeholder="0.00" />
                <FieldError message={errors.price?.message} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="compareAt">
                  Compare-at price <span className="font-normal text-subtle">(optional)</span>
                </Label>
                <Input id="compareAt" inputMode="decimal" aria-invalid={Boolean(errors.compareAt)} {...register("compareAt")} placeholder="Shows as a sale" />
                <FieldError message={errors.compareAt?.message} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="lowStockThreshold">Low stock alert at</Label>
                <Input id="lowStockThreshold" inputMode="numeric" aria-invalid={Boolean(errors.lowStockThreshold)} {...register("lowStockThreshold")} />
                {errors.lowStockThreshold ? (
                  <FieldError message={errors.lowStockThreshold.message} />
                ) : (
                  <p className="text-[13px] text-subtle">Shows &ldquo;Only N left&rdquo; in the store.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Variants and stock</CardTitle>
                <CardDescription>
                  Each color and size combination is a variant with its own stock. {totalStock} in stock in total.
                </CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => variants.append(emptyVariant)}>
                <Plus /> Add variant
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_auto_auto] gap-2 text-[12px] font-medium text-subtle lg:grid">
                <span>Color</span>
                <span>Size</span>
                <span>SKU</span>
                <span>Price</span>
                <span>Stock</span>
                <span>Active</span>
                <span className="w-9" />
              </div>
              {variants.fields.map((f, i) => {
                const e = errors.variants?.[i];
                const message = e?.colorName?.message ?? e?.colorHex?.message ?? e?.size?.message ?? e?.sku?.message ?? e?.price?.message ?? e?.stock?.message;
                return (
                  <div key={f.id} className="flex flex-col gap-1 rounded-xl border border-line p-3 lg:border-0 lg:p-0">
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_auto_auto] lg:items-center">
                      <div className="col-span-2 flex items-center gap-2 lg:col-span-1">
                        <Controller
                          control={control}
                          name={`variants.${i}.colorHex`}
                          render={({ field }) => (
                            <label
                              className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-line bg-[repeating-conic-gradient(var(--line)_0_25%,transparent_0_50%)] bg-[length:8px_8px]"
                              style={field.value ? { background: field.value } : undefined}
                              title="Pick the swatch color"
                            >
                              <span className="sr-only">Variant {i + 1} swatch</span>
                              <input type="color" value={field.value || "#1d1e22"} onChange={field.onChange} className="absolute inset-0 cursor-pointer opacity-0" />
                            </label>
                          )}
                        />
                        <Input aria-label={`Variant ${i + 1} color`} placeholder="Color, e.g. Graphite" {...register(`variants.${i}.colorName`)} />
                      </div>
                      <Input aria-label={`Variant ${i + 1} size`} placeholder="Size" aria-invalid={Boolean(e?.size)} {...register(`variants.${i}.size`)} />
                      <Input aria-label={`Variant ${i + 1} SKU`} placeholder="Auto" className="font-mono uppercase" aria-invalid={Boolean(e?.sku)} {...register(`variants.${i}.sku`)} />
                      <Input aria-label={`Variant ${i + 1} price`} placeholder={values.price || "Same"} inputMode="decimal" aria-invalid={Boolean(e?.price)} {...register(`variants.${i}.price`)} />
                      <Input aria-label={`Variant ${i + 1} stock`} inputMode="numeric" className="tabular-nums" aria-invalid={Boolean(e?.stock)} {...register(`variants.${i}.stock`)} />
                      <Controller
                        control={control}
                        name={`variants.${i}.isActive`}
                        render={({ field }) => (
                          <label className="flex items-center gap-2 text-[13px] text-subtle lg:justify-center">
                            <Switch checked={field.value} onCheckedChange={field.onChange} aria-label={`Variant ${i + 1} can be bought`} />
                            <span className="lg:sr-only">Can be bought</span>
                          </label>
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove variant ${i + 1}`}
                        disabled={variants.fields.length === 1}
                        onClick={() => variants.remove(i)}
                        className="justify-self-end"
                      >
                        <Trash />
                      </Button>
                    </div>
                    <FieldError message={message} />
                  </div>
                );
              })}
              <FieldError message={errors.variants?.root?.message ?? errors.variants?.message} />
              <p className="text-[13px] text-subtle">Leave price empty to use the product price. Leave SKU empty and it&apos;s made for you.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Details</CardTitle>
                <CardDescription>Short facts, one per line.</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => details.append({ value: "" })}>
                <Plus /> Add line
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {details.fields.length === 0 && <p className="text-[14px] text-subtle">No details yet.</p>}
              {details.fields.map((f, i) => (
                <div key={f.id} className="flex flex-col gap-1">
                  <div className="flex gap-2">
                    <Input aria-label={`Detail ${i + 1}`} {...register(`details.${i}.value`)} placeholder="For example: USB-C, 2 months per charge" />
                    <Button type="button" variant="ghost" size="icon" aria-label={`Remove detail ${i + 1}`} onClick={() => details.remove(i)}>
                      <Trash />
                    </Button>
                  </div>
                  <FieldError message={errors.details?.[i]?.value?.message} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Search engines</CardTitle>
              <CardDescription>Optional. Defaults to the name and description.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="seoTitle">Page title</Label>
                <Input id="seoTitle" aria-invalid={Boolean(errors.seoTitle)} {...register("seoTitle")} placeholder={values.name} />
                <FieldError message={errors.seoTitle?.message} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="seoDescription">Meta description</Label>
                <Textarea id="seoDescription" rows={2} aria-invalid={Boolean(errors.seoDescription)} {...register("seoDescription")} />
                {errors.seoDescription ? (
                  <FieldError message={errors.seoDescription.message} />
                ) : (
                  <p className="text-[13px] text-subtle">{values.seoDescription?.length ?? 0}/320</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-label="Status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active, visible in the store</SelectItem>
                      <SelectItem value="draft">Draft, hidden</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              <Controller
                control={control}
                name="isFeatured"
                render={({ field }) => (
                  <label className="flex items-center justify-between gap-3 text-[14px] text-ink">
                    <span>
                      Featured
                      <span className="block text-[13px] text-subtle">Shown first in the store and by the agent.</span>
                    </span>
                    <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Featured" />
                  </label>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Store preview</CardTitle>
              <CardDescription>How the card looks in the shop.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="pointer-events-none mx-auto max-w-[280px]">
                <ProductCard product={preview} sizes="280px" />
              </div>
            </CardContent>
          </Card>

          {product && (
            <Card className="border-danger/30">
              <CardHeader>
                <CardTitle>Remove from store</CardTitle>
                <CardDescription>Archiving hides it and keeps order history. Deleting can&rsquo;t be undone.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={archive} disabled={acting || product.status === "archived"}>
                  <Archive /> {product.status === "archived" ? "Archived" : "Archive"}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive" disabled={acting}>
                      <Trash /> Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {product.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        It disappears from the store and the agent stops recommending it. Past orders keep their copy of the item.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep product</AlertDialogCancel>
                      <AlertDialogAction className="bg-danger text-white hover:bg-danger/90" onClick={remove}>
                        Delete product
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 -mb-6 mt-6 border-t border-line bg-bg/90 backdrop-blur-xl md:-mx-6 md:-mb-8">
        <div className="flex items-center justify-end gap-2 px-4 py-3 md:px-6">
          <p className="mr-auto text-[13px] text-subtle">
            {Object.keys(errors).length ? (
              <span className="text-danger">Fix the highlighted fields to save.</span>
            ) : isDirty || (!editing && pendingImages.length) ? (
              "Unsaved changes"
            ) : (
              "No changes yet"
            )}
          </p>
          <Button type="button" variant="outline" onClick={() => (editing ? form.reset() : router.push("/admin/products"))} disabled={isSubmitting}>
            {editing ? "Undo changes" : "Cancel"}
          </Button>
          <Button type="submit" disabled={isSubmitting || (editing && !isDirty)}>
            {isSubmitting && <Spinner />} {editing ? "Save product" : "Create product"}
          </Button>
        </div>
      </div>
    </form>
  );
}

"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Archive, ImageSquare, Plus, Trash, UploadSimple, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { categories, type CategorySlug } from "@/lib/catalog";
import type { AdminProduct } from "@/lib/admin/mock";

const schema = z
  .object({
    name: z.string().trim().min(3, "Use at least 3 characters."),
    brand: z.string().trim().min(2, "Enter the brand."),
    description: z.string().trim().min(20, "Write at least 20 characters so customers and the agent understand it.").max(400, "Keep it under 400 characters."),
    category: z.enum(["audio", "tech", "home", "style", "kitchen"]),
    status: z.enum(["active", "draft", "archived"]),
    price: z.coerce.number<string>({ message: "Enter a price." }).positive("Price must be more than $0."),
    compareAt: z.union([z.literal(""), z.coerce.number<string>().positive()]).optional(),
    stock: z.coerce.number<string>().int("Whole numbers only.").min(0, "Stock can't be negative."),
    lowStockThreshold: z.coerce.number<string>().int().min(0),
    details: z.array(z.object({ value: z.string().trim().min(1, "Remove empty lines.") })),
    colors: z.array(
      z.object({
        name: z.string().trim().min(1, "Name the color."),
        hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex like #1d1e22."),
      }),
    ),
  })
  .refine((v) => v.compareAt === "" || v.compareAt === undefined || Number(v.compareAt) > Number(v.price), {
    path: ["compareAt"],
    message: "Compare-at price should be higher than the price.",
  });

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-[13px] text-danger">
      {message}
    </p>
  );
}

export function ProductForm({ product }: { product?: AdminProduct }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<string[]>(product?.gallery ?? []);
  const [imageError, setImageError] = useState<string | null>(null);

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: product?.name ?? "",
      brand: product?.brand ?? "",
      description: product?.description ?? "",
      category: product?.category ?? "tech",
      status: product?.status ?? "draft",
      price: product ? String(product.price) : "",
      compareAt: product?.compareAt ? String(product.compareAt) : "",
      stock: product ? String(product.stock) : "0",
      lowStockThreshold: product ? String(product.lowStockThreshold) : "5",
      details: (product?.details ?? [""]).map((value) => ({ value })),
      colors: product?.colors ?? [],
    },
  });
  const { register, control, handleSubmit, watch, formState } = form;
  const { errors, isDirty, isSubmitting } = formState;
  const details = useFieldArray({ control, name: "details" });
  const colors = useFieldArray({ control, name: "colors" });

  // eslint-disable-next-line react-hooks/incompatible-library -- RHF watch drives the live preview
  const values = watch();
  const previewPrice = Number(values.price) || 0;
  const preview = {
    id: product?.id ?? "preview",
    name: values.name || "Product name",
    brand: values.brand || "Brand",
    category: values.category as CategorySlug,
    price: previewPrice,
    compareAt: values.compareAt ? Number(values.compareAt) : undefined,
    image: images[0] ?? "https://picsum.photos/id/1/800/1000",
    gallery: images,
    rating: product?.rating ?? 0,
    reviews: product?.reviews ?? 0,
    stock: Number(values.stock) || 0,
    addedOn: product?.addedOn ?? "2026-10-10",
    description: values.description,
    details: [],
    tag: product ? product.tag : ("New" as const),
  };

  const onSubmit = async (data: FormOutput) => {
    if (images.length === 0) {
      setImageError("Add at least one image.");
      return;
    }
    await new Promise((r) => setTimeout(r, 600));
    toast.success(product ? `Saved ${data.name}` : `Created ${data.name}`, {
      description: "Demo mode: the agent search index would refresh now.",
    });
    router.push("/admin/products");
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const urls = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => URL.createObjectURL(f));
    setImages((prev) => [...prev, ...urls].slice(0, 8));
    setImageError(null);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-ink md:text-[28px]">
              {product ? product.name : "New product"}
            </h1>
            {product && <ProductStatusBadge status={product.status} />}
          </div>
          <p className="mt-1 text-[14px] text-subtle">
            {product ? `ID ${product.id}. Saving updates the store and the agent's product search.` : "Drafts are hidden from the store until you set them to Active."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
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
                  name="category"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="category" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" rows={4} aria-invalid={Boolean(errors.description)} aria-describedby="description-hint" {...register("description")} />
                {errors.description ? (
                  <FieldError message={errors.description.message} />
                ) : (
                  <p id="description-hint" className="text-[13px] text-subtle">
                    {values.description?.length ?? 0}/400. The agent reads this when answering questions.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Images</CardTitle>
              <CardDescription>The first image is the main photo. Up to 8.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {images.map((src, i) => (
                  <li key={src + i} className="group relative aspect-square overflow-hidden rounded-xl bg-surface-2">
                    <Image src={src} alt={`Product image ${i + 1}`} fill sizes="160px" className="object-cover" unoptimized={src.startsWith("blob:")} />
                    {i === 0 && (
                      <span className="absolute left-2 top-2 rounded-full bg-ink px-2 py-0.5 text-[11px] font-medium text-bg">Main</span>
                    )}
                    <button
                      type="button"
                      aria-label={`Remove image ${i + 1}`}
                      onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-surface/90 text-ink opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      addFiles(e.dataTransfer.files);
                    }}
                    className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line text-[12px] text-subtle transition hover:border-brand hover:text-brand"
                  >
                    {images.length ? <UploadSimple size={20} /> : <ImageSquare size={22} />}
                    Upload
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
                </li>
              </ul>
              <FieldError message={imageError ?? undefined} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pricing and inventory</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="price">Price (USD)</Label>
                <Input id="price" inputMode="decimal" aria-invalid={Boolean(errors.price)} {...register("price")} placeholder="0.00" />
                <FieldError message={errors.price?.message} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="compareAt">Compare-at price <span className="font-normal text-subtle">(optional)</span></Label>
                <Input id="compareAt" inputMode="decimal" aria-invalid={Boolean(errors.compareAt)} {...register("compareAt")} placeholder="Shows as a sale" />
                <FieldError message={errors.compareAt?.message} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="stock">Stock</Label>
                <Input id="stock" inputMode="numeric" aria-invalid={Boolean(errors.stock)} {...register("stock")} />
                <FieldError message={errors.stock?.message} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="lowStockThreshold">Low stock alert at</Label>
                <Input id="lowStockThreshold" inputMode="numeric" {...register("lowStockThreshold")} />
                <p className="text-[13px] text-subtle">Shows &ldquo;Only N left&rdquo; in the store.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Colors</CardTitle>
                <CardDescription>Shown as swatches on the product page.</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => colors.append({ name: "", hex: "#1d1e22" })}>
                <Plus /> Add color
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {colors.fields.length === 0 && <p className="text-[14px] text-subtle">No colors. Customers won&rsquo;t see a color picker.</p>}
              {colors.fields.map((f, i) => (
                <div key={f.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Controller
                      control={control}
                      name={`colors.${i}.hex`}
                      render={({ field }) => (
                        <label className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-line" style={{ background: field.value }}>
                          <span className="sr-only">Pick color {i + 1}</span>
                          <input type="color" value={field.value} onChange={field.onChange} className="absolute inset-0 cursor-pointer opacity-0" />
                        </label>
                      )}
                    />
                    <Input aria-label={`Color ${i + 1} name`} placeholder="Color name" {...register(`colors.${i}.name`)} />
                    <Input aria-label={`Color ${i + 1} hex`} className="w-28 font-mono" {...register(`colors.${i}.hex`)} />
                    <Button type="button" variant="ghost" size="icon" aria-label={`Remove color ${i + 1}`} onClick={() => colors.remove(i)}>
                      <Trash />
                    </Button>
                  </div>
                  <FieldError message={errors.colors?.[i]?.name?.message ?? errors.colors?.[i]?.hex?.message} />
                </div>
              ))}
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
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Store preview</CardTitle>
              <CardDescription>How the card looks in the shop.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mx-auto max-w-[280px]">
                <ProductCard product={preview} sizes="280px" />
              </div>
            </CardContent>
          </Card>

          {product && (
            <Card className="border-danger/30">
              <CardHeader>
                <CardTitle>Remove from store</CardTitle>
                <CardDescription>Archiving keeps order history. Deleting can&rsquo;t be undone.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    toast.success(`${product.name} archived`);
                    router.push("/admin/products");
                  }}
                >
                  <Archive /> Archive
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive">
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
                      <AlertDialogAction
                        className="bg-[#c62f2f] text-[#fbfbfc] hover:bg-[#c62f2f]/90"
                        onClick={() => {
                          toast.success(`${product.name} deleted`);
                          router.push("/admin/products");
                        }}
                      >
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
          <p className="mr-auto text-[13px] text-subtle">{isDirty ? "Unsaved changes" : "No changes yet"}</p>
          <Button type="button" variant="outline" onClick={() => router.push("/admin/products")}>
            Discard
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving" : product ? "Save product" : "Create product"}
          </Button>
        </div>
      </div>
    </form>
  );
}

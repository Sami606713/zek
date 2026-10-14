"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowSquareOut,
  ArrowUp,
  ImageSquare,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Stack,
  Trash,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, ErrorState } from "@/components/admin/states";
import { unoptimized } from "@/lib/admin/images";
import { errorMessage, useAdminAction, useAdminQuery } from "@/lib/admin/useAdminQuery";
import {
  adminCollections,
  adminProducts,
  type AdminCollectionDetail,
  type AdminCollectionRow,
  type AdminProductRow,
} from "@/lib/api/admin";

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const isUrl = (v: string) => /^https?:\/\/\S+$/i.test(v);

const toDay = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fromDay = (day: string, end = false) => (day ? new Date(`${day}T${end ? "23:59:59" : "00:00:00"}`).toISOString() : null);

/** Where the collection stands in the store right now. */
function visibility(c: AdminCollectionRow): { label: string; dot: string } {
  if (!c.is_published) return { label: "Hidden", dot: "bg-subtle" };
  if (c.is_live) return { label: "Live", dot: "bg-brand" };
  if (c.starts_at && new Date(c.starts_at) > new Date()) return { label: "Scheduled", dot: "bg-ink" };
  return { label: "Ended", dot: "bg-subtle" };
}

export function CollectionsManager() {
  const list = useAdminQuery("collections", () => adminCollections.list({ limit: 100 }));
  const [editor, setEditor] = useState<{ id: string | null } | null>(null);
  const { run, pending } = useAdminAction();

  const publish = async (c: AdminCollectionRow, on: boolean) => {
    if (await run(() => adminCollections.update(c.id, { is_published: on }), `${c.title} is now ${on ? "published" : "hidden"}`)) {
      list.refetch();
    }
  };

  const items = list.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Collections"
        description="Hand-picked groups of products shown on the Collections page."
        actions={
          <Button onClick={() => setEditor({ id: null })}>
            <Plus /> New collection
          </Button>
        }
      />

      {list.loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-80 rounded-xl" />
          ))}
        </div>
      ) : list.error && !list.data ? (
        <ErrorState error={list.error} onRetry={list.refetch} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Stack}
          title="No collections yet"
          description="Group products, like “Gifts under $50”, to show them together in the store."
          action={
            <Button onClick={() => setEditor({ id: null })}>
              <Plus /> New collection
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy={list.refreshing}>
          {items.map((c, i) => {
            const image = c.image_url ?? c.preview_images?.[0];
            const state = visibility(c);
            return (
              <Card key={c.id} className="overflow-hidden py-0">
                <div className="relative grid aspect-[16/9] place-items-center bg-surface-2 text-subtle">
                  {image ? (
                    <Image src={image} alt="" fill priority={i < 3} sizes="(min-width: 1280px) 33vw, 50vw" className="object-cover" unoptimized={unoptimized(image)} />
                  ) : (
                    <ImageSquare size={28} />
                  )}
                  {/* Solid chip so it reads on any photo. */}
                  <Badge className="absolute left-3 top-3 gap-1.5 rounded-full border-transparent bg-surface/95 text-ink shadow-sm backdrop-blur">
                    <span className={`size-1.5 rounded-full ${state.dot}`} />
                    {state.label}
                  </Badge>
                </div>
                <CardContent className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-[16px] font-semibold text-ink">{c.title}</h2>
                      <p className="truncate text-[13px] text-subtle">
                        {c.product_count} {c.product_count === 1 ? "product" : "products"}, /collections/{c.slug}
                      </p>
                    </div>
                    <label className="flex shrink-0 items-center gap-2 text-[13px] text-subtle">
                      {c.is_published ? "Published" : "Hidden"}
                      <Switch
                        checked={c.is_published}
                        disabled={pending}
                        onCheckedChange={(v) => void publish(c, v)}
                        aria-label={`Publish ${c.title}`}
                      />
                    </label>
                  </div>
                  {c.blurb && <p className="line-clamp-2 text-[14px] text-subtle">{c.blurb}</p>}
                  <div className="mt-auto flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditor({ id: c.id })}>
                      <PencilSimple /> Edit
                    </Button>
                    {c.is_live && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={`/collections/${c.slug}`} target="_blank" rel="noreferrer">
                          <ArrowSquareOut /> View
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={Boolean(editor)} onOpenChange={(o) => !o && setEditor(null)}>
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-lg">
          {editor && (
            <CollectionEditor
              key={editor.id ?? "new"}
              id={editor.id}
              onDone={() => {
                setEditor(null);
                list.refetch();
              }}
              onCancel={() => setEditor(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

// ── Editor (loads the full collection when editing) ─────────────────────────

function CollectionEditor({ id, onDone, onCancel }: { id: string | null; onDone: () => void; onCancel: () => void }) {
  const detail = useAdminQuery(`collection:${id}`, () => (id ? adminCollections.get(id) : Promise.resolve(null)));
  if (id && detail.loading) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Edit collection</SheetTitle>
          <SheetDescription>Loading…</SheetDescription>
        </SheetHeader>
        <div className="grid flex-1 place-items-center text-subtle">
          <Spinner />
        </div>
      </>
    );
  }
  if (id && !detail.data) {
    return (
      <div className="p-4">
        <SheetTitle className="sr-only">Edit collection</SheetTitle>
        <ErrorState error={detail.error} onRetry={detail.refetch} />
      </div>
    );
  }
  return <CollectionForm detail={detail.data ?? null} onDone={onDone} onCancel={onCancel} onImageChange={detail.refetch} />;
}

function CollectionForm({
  detail,
  onDone,
  onCancel,
  onImageChange,
}: {
  detail: AdminCollectionDetail | null;
  onDone: () => void;
  onCancel: () => void;
  onImageChange: () => void;
}) {
  const [title, setTitle] = useState(detail?.title ?? "");
  const [slug, setSlug] = useState(detail?.slug ?? "");
  const [blurb, setBlurb] = useState(detail?.blurb ?? "");
  const [imageUrl, setImageUrl] = useState(detail && !detail.has_hosted_image ? (detail.image_url ?? "") : "");
  const [published, setPublished] = useState(detail?.is_published ?? false);
  const [sortOrder, setSortOrder] = useState(String(detail?.sort_order ?? 0));
  const [startsAt, setStartsAt] = useState(toDay(detail?.starts_at ?? null));
  const [endsAt, setEndsAt] = useState(toDay(detail?.ends_at ?? null));
  const [products, setProducts] = useState<AdminProductRow[]>(
    () => detail?.products.slice().sort((a, b) => a.position - b.position).map((p) => p.product) ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { run, pending } = useAdminAction();
  const fileRef = useRef<HTMLInputElement>(null);

  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= products.length) return;
    const next = [...products];
    [next[i], next[j]] = [next[j], next[i]];
    setProducts(next);
  };

  const validate = () => {
    if (!title.trim()) return "Give the collection a title.";
    if (title.trim().length > 120) return "Keep the title under 120 characters.";
    if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return "The URL can use lowercase letters, numbers and single dashes.";
    if (imageUrl && !isUrl(imageUrl)) return "The banner link must start with https://";
    if (blurb.length > 500) return "Keep the description under 500 characters.";
    if (!/^\d{1,5}$/.test(sortOrder)) return "Order must be a whole number.";
    if (startsAt && endsAt && endsAt < startsAt) return "The end date must be on or after the start date.";
    return null;
  };

  const save = async () => {
    const problem = validate();
    if (problem) return setError(problem);
    setError(null);
    setSaving(true);
    const fields = {
      title: title.trim(),
      blurb: blurb.trim() || null,
      is_published: published,
      sort_order: Number(sortOrder),
      starts_at: fromDay(startsAt),
      ends_at: fromDay(endsAt, true),
    };
    const ids = products.map((p) => p.id);
    try {
      if (!detail) {
        await adminCollections.create({ ...fields, slug: slug || null, image_url: imageUrl || null, product_ids: ids });
        toast.success(`Created ${fields.title}`);
      } else {
        await adminCollections.update(detail.id, {
          ...fields,
          ...(slug && slug !== detail.slug ? { slug } : {}),
          // A hosted (uploaded) banner is managed by the upload buttons, not this field.
          ...(!detail.has_hosted_image ? { image_url: imageUrl || null } : {}),
        });
        const before = detail.products.slice().sort((a, b) => a.position - b.position).map((p) => p.product.id);
        if (before.join() !== ids.join()) await adminCollections.setProducts(detail.id, { product_ids: ids });
        toast.success(`Saved ${fields.title}`);
      }
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (detail && (await run(() => adminCollections.remove(detail.id), `Deleted ${detail.title}`))) onDone();
  };

  const upload = async (file: File | undefined) => {
    if (!detail || !file) return;
    if (await run(() => adminCollections.uploadImage(detail.id, file), "Banner uploaded")) onImageChange();
  };

  const banner = detail?.has_hosted_image ? detail.image_url : imageUrl && isUrl(imageUrl) ? imageUrl : null;

  return (
    <>
      <SheetHeader>
        <SheetTitle>{detail ? `Edit ${detail.title}` : "New collection"}</SheetTitle>
        <SheetDescription>Pick products and set the order they appear in.</SheetDescription>
      </SheetHeader>
      {/* Plain overflow: Radix ScrollArea lets wide content push past the sheet edge. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-5 px-4 pb-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="c-title">Title</Label>
            <Input id="c-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Gifts under $50" maxLength={120} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="c-slug">URL</Label>
            <Input
              id="c-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder={slugify(title) || "made-from-the-title"}
              className="font-mono"
              maxLength={80}
            />
            <p className="text-[13px] text-subtle">/collections/{slug || slugify(title) || "…"}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="c-blurb">Description</Label>
            <Textarea id="c-blurb" rows={3} value={blurb} onChange={(e) => setBlurb(e.target.value)} maxLength={500} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="c-image">Banner image</Label>
            <div className="relative grid aspect-[16/9] place-items-center overflow-hidden rounded-xl bg-surface-2 text-subtle">
              {banner ? (
                <Image src={banner} alt="" fill sizes="480px" className="object-cover" unoptimized={unoptimized(banner)} />
              ) : (
                <span className="text-[13px]">No banner. The first product photos are used.</span>
              )}
            </div>
            {detail?.has_hosted_image ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                disabled={pending}
                onClick={async () => {
                  if (await run(() => adminCollections.removeImage(detail.id), "Banner removed")) onImageChange();
                }}
              >
                <Trash /> Remove uploaded banner
              </Button>
            ) : (
              <div className="flex gap-2">
                <Input id="c-image" value={imageUrl} onChange={(e) => setImageUrl(e.target.value.trim())} placeholder="Paste an image link" />
                {detail && (
                  <>
                    <Button type="button" variant="outline" disabled={pending} onClick={() => fileRef.current?.click()}>
                      {pending ? <Spinner /> : <UploadSimple />} Upload
                    </Button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                      hidden
                      onChange={(e) => {
                        void upload(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </>
                )}
              </div>
            )}
          </div>

          <label className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5 text-[14px]">
            Published in the store
            <Switch checked={published} onCheckedChange={setPublished} />
          </label>

          <div className="grid grid-cols-[1fr_1fr_4.5rem] gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="c-start">Show from</Label>
              <Input id="c-start" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="c-end">Until</Label>
              <Input id="c-end" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="c-order">Order</Label>
              <Input id="c-order" inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value.replace(/\D/g, ""))} />
            </div>
          </div>
          <p className="-mt-3 text-[13px] text-subtle">Dates are optional. Lower order numbers show first.</p>

          <div className="flex flex-col gap-2">
            <p className="text-[14px] font-medium text-ink">In this collection ({products.length})</p>
            {products.length === 0 && <p className="text-[13px] text-subtle">Search below to add products.</p>}
            <ol className="flex flex-col gap-1.5">
              {products.map((p, i) => (
                <li key={p.id} className="flex items-center gap-2 rounded-lg bg-surface-2 px-2 py-1.5">
                  <span className="w-5 text-center text-[12px] tabular-nums text-subtle">{i + 1}</span>
                  <Thumb src={p.image?.url} />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                    {p.name}
                    {p.status !== "active" && <span className="ml-1 text-subtle">({p.status})</span>}
                  </span>
                  <Button variant="ghost" size="icon-xs" aria-label={`Move ${p.name} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp />
                  </Button>
                  <Button variant="ghost" size="icon-xs" aria-label={`Move ${p.name} down`} disabled={i === products.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown />
                  </Button>
                  <Button variant="ghost" size="icon-xs" aria-label={`Remove ${p.name}`} onClick={() => setProducts(products.filter((x) => x.id !== p.id))}>
                    <X />
                  </Button>
                </li>
              ))}
            </ol>
          </div>

          <ProductPicker
            selected={products}
            onToggle={(p, on) => setProducts(on ? [...products, p] : products.filter((x) => x.id !== p.id))}
          />

          {detail && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost" className="self-start text-danger hover:text-danger" disabled={pending}>
                  <Trash /> Delete collection
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {detail.title}?</AlertDialogTitle>
                  <AlertDialogDescription>The products stay in the store. Only this grouping is removed.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep collection</AlertDialogCancel>
                  <AlertDialogAction className="bg-danger text-white hover:bg-danger/90" onClick={remove}>
                    Delete collection
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
      <SheetFooter className="border-t border-line">
        {error && (
          <p role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={save} disabled={saving}>
            {saving && <Spinner />} {detail ? "Save collection" : "Create collection"}
          </Button>
        </div>
      </SheetFooter>
    </>
  );
}

/** Search the catalogue and tick products to add them. */
function ProductPicker({ selected, onToggle }: { selected: AdminProductRow[]; onToggle: (p: AdminProductRow, on: boolean) => void }) {
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);
  const results = useAdminQuery(`picker:${q}`, () => adminProducts.list({ q: q || undefined, sort: "name", limit: 30 }));
  const chosen = new Set(selected.map((p) => p.id));

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[14px] font-medium text-ink">Add products</p>
      <label className="relative">
        <span className="sr-only">Search products</span>
        <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Search products" className="pl-9" />
      </label>
      {results.loading ? (
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
          ))}
        </div>
      ) : results.error && !results.data ? (
        <p className="text-[13px] text-danger">{errorMessage(results.error)}</p>
      ) : (
        <div className="flex flex-col gap-0.5" aria-busy={results.refreshing}>
          {results.data?.items.length === 0 && <p className="text-[13px] text-subtle">No products match.</p>}
          {results.data?.items.map((p) => (
            <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-2">
              <Checkbox checked={chosen.has(p.id)} onCheckedChange={(v) => onToggle(p, Boolean(v))} />
              <Thumb src={p.image?.url} />
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{p.name}</span>
              <span className="text-[12px] text-subtle">{p.status === "active" ? p.category?.name : p.status}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function Thumb({ src }: { src?: string | null }) {
  return (
    <span className="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-md bg-surface text-subtle">
      {src ? <Image src={src} alt="" fill sizes="32px" className="object-cover" unoptimized={unoptimized(src)} /> : <ImageSquare size={14} />}
    </span>
  );
}

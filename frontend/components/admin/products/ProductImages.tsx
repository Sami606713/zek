"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImageSquare, LinkSimple, UploadSimple, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { unoptimized } from "@/lib/admin/images";
import { useAdminAction } from "@/lib/admin/useAdminQuery";
import { adminProducts, type ProductImage } from "@/lib/api/admin";

const MAX_IMAGES = 12;
const isUrl = (v: string) => /^https?:\/\/\S+$/i.test(v);

/** An image waiting to be sent once a new product exists. */
export type PendingImage = { key: string; preview: string; file?: File; url?: string };

type Props =
  | { mode: "edit"; productId: string; images: ProductImage[]; onChange: () => void }
  | { mode: "create"; pending: PendingImage[]; onPendingChange: (images: PendingImage[]) => void };

/**
 * Edit mode saves each change right away. Create mode keeps a local list that
 * `uploadPending` sends after the product is created (images need a product id).
 */
export function ProductImages(props: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const { run, pending } = useAdminAction();

  const items =
    props.mode === "edit"
      ? props.images.map((i) => ({ key: i.id, src: i.url }))
      : props.pending.map((i) => ({ key: i.key, src: i.preview }));
  const full = items.length >= MAX_IMAGES;

  const addFiles = async (list: FileList | null) => {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith("image/")).slice(0, MAX_IMAGES - items.length);
    if (!files.length) return;
    if (props.mode === "create") {
      props.onPendingChange([
        ...props.pending,
        ...files.map((file) => ({ key: crypto.randomUUID(), preview: URL.createObjectURL(file), file })),
      ]);
      return;
    }
    for (const file of files) {
      const ok = await run(() => adminProducts.uploadImage(props.productId, file), `Uploaded ${file.name}`);
      if (!ok) break;
    }
    props.onChange();
  };

  const addUrl = async () => {
    const value = url.trim();
    if (!isUrl(value)) return setUrlError("Paste a full image link starting with https://");
    if (props.mode === "create") {
      props.onPendingChange([...props.pending, { key: crypto.randomUUID(), preview: value, url: value }]);
    } else {
      if (!(await run(() => adminProducts.addImageUrl(props.productId, { url: value }), "Image added"))) return;
      props.onChange();
    }
    setUrl("");
  };

  const remove = async (index: number) => {
    if (props.mode === "create") {
      const gone = props.pending[index];
      if (gone.file) URL.revokeObjectURL(gone.preview);
      props.onPendingChange(props.pending.filter((_, i) => i !== index));
      return;
    }
    if (await run(() => adminProducts.removeImage(props.productId, props.images[index].id), "Image removed")) props.onChange();
  };

  /** Move one image left or right; position 0 is the main photo. */
  const move = async (index: number, by: -1 | 1) => {
    const to = index + by;
    if (to < 0 || to >= items.length) return;
    if (props.mode === "create") {
      const next = [...props.pending];
      [next[index], next[to]] = [next[to], next[index]];
      props.onPendingChange(next);
      return;
    }
    const ids = props.images.map((i) => i.id);
    [ids[index], ids[to]] = [ids[to], ids[index]];
    if (await run(() => adminProducts.reorderImages(props.productId, { image_ids: ids }))) props.onChange();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Images</CardTitle>
        <CardDescription>
          The first image is the main photo. Up to {MAX_IMAGES}.
          {props.mode === "edit" ? " Changes here save right away." : " They're added when you create the product."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4" aria-busy={pending}>
          {items.map((img, i) => (
            <li key={img.key} className="group relative aspect-square overflow-hidden rounded-xl bg-surface-2">
              <Image src={img.src} alt={`Product image ${i + 1}`} fill sizes="160px" className="object-cover" unoptimized={unoptimized(img.src)} />
              {i === 0 && (
                <span className="absolute left-2 top-2 rounded-full bg-ink px-2 py-0.5 text-[11px] font-medium text-bg">Main</span>
              )}
              <div className="absolute inset-x-2 bottom-2 flex justify-between opacity-100 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                <span className="flex gap-1">
                  <IconButton label={`Move image ${i + 1} left`} disabled={pending || i === 0} onClick={() => move(i, -1)}>
                    <ArrowLeft size={13} />
                  </IconButton>
                  <IconButton label={`Move image ${i + 1} right`} disabled={pending || i === items.length - 1} onClick={() => move(i, 1)}>
                    <ArrowRight size={13} />
                  </IconButton>
                </span>
                <IconButton label={`Remove image ${i + 1}`} disabled={pending} onClick={() => remove(i)}>
                  <X size={13} />
                </IconButton>
              </div>
            </li>
          ))}
          {!full && (
            <li>
              <button
                type="button"
                disabled={pending}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void addFiles(e.dataTransfer.files);
                }}
                className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line text-[12px] text-subtle transition hover:border-brand hover:text-brand disabled:opacity-60"
              >
                {pending ? <Spinner /> : items.length ? <UploadSimple size={20} /> : <ImageSquare size={22} />}
                Upload
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                multiple
                hidden
                onChange={(e) => {
                  void addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </li>
          )}
        </ul>

        {!full && (
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-2">
              <label className="relative flex-1">
                <span className="sr-only">Image link</span>
                <LinkSimple size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
                <Input
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setUrlError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void addUrl();
                    }
                  }}
                  placeholder="Or paste an image link"
                  className="pl-9"
                  aria-invalid={Boolean(urlError)}
                />
              </label>
              <Button type="button" variant="outline" onClick={addUrl} disabled={pending || !url.trim()}>
                Add link
              </Button>
            </div>
            {urlError && <p role="alert" className="text-[13px] text-danger">{urlError}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-full bg-surface/90 text-ink shadow-sm transition hover:bg-surface disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** Sends queued images to a newly created product, in order. Returns how many failed. */
export async function uploadPending(productId: string, images: PendingImage[]): Promise<{ failed: number; error?: unknown }> {
  let failed = 0;
  let error: unknown;
  for (const img of images) {
    try {
      if (img.file) await adminProducts.uploadImage(productId, img.file);
      else if (img.url) await adminProducts.addImageUrl(productId, { url: img.url });
    } catch (e) {
      failed += 1;
      error ??= e;
    }
  }
  return { failed, error };
}

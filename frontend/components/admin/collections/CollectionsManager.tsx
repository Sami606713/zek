"use client";

import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowSquareOut, ArrowUp, PencilSimple, Plus, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PageHeader } from "@/components/admin/PageHeader";
import { adminCollections, adminProducts, type AdminCollection } from "@/lib/admin/mock";

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const blank: AdminCollection = {
  slug: "",
  title: "",
  blurb: "",
  image: "https://picsum.photos/id/42/1200/1200",
  productIds: [],
  visible: false,
};

export function CollectionsManager() {
  const [items, setItems] = useState(adminCollections);
  const [editing, setEditing] = useState<AdminCollection | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const products = adminProducts.filter((p) => p.status === "active");

  const open = (c: AdminCollection | null) => {
    setIsNew(!c);
    setEditing(c ? { ...c, productIds: [...c.productIds] } : { ...blank });
    setError(null);
  };

  const move = (i: number, dir: -1 | 1) => {
    if (!editing) return;
    const ids = [...editing.productIds];
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setEditing({ ...editing, productIds: ids });
  };

  const save = () => {
    if (!editing) return;
    if (editing.title.trim().length < 3) return setError("Give the collection a title of at least 3 characters.");
    if (editing.productIds.length === 0) return setError("Pick at least one product.");
    const slug = editing.slug || slugify(editing.title);
    const next = { ...editing, slug };
    setItems((prev) => (isNew ? [...prev, next] : prev.map((c) => (c.slug === editing.slug ? next : c))));
    toast.success(isNew ? `Created ${next.title}` : `Saved ${next.title}`);
    setEditing(null);
  };

  return (
    <>
      <PageHeader
        title="Collections"
        description="Hand-picked groups of products shown on the Collections page."
        actions={
          <Button onClick={() => open(null)}>
            <Plus /> New collection
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((c, i) => (
          <Card key={c.slug} className="overflow-hidden py-0">
            <div className="relative aspect-[16/9] bg-surface-2">
              <Image src={c.image} alt="" fill priority={i < 3} sizes="(min-width: 1280px) 33vw, 50vw" className="object-cover" />
            </div>
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-[16px] font-semibold text-ink">{c.title}</h2>
                  <p className="text-[13px] text-subtle">{c.productIds.length} products, /collections/{c.slug}</p>
                </div>
                <label className="flex shrink-0 items-center gap-2 text-[13px] text-subtle">
                  {c.visible ? "Visible" : "Hidden"}
                  <Switch
                    checked={c.visible}
                    onCheckedChange={(v) => {
                      setItems((prev) => prev.map((x) => (x.slug === c.slug ? { ...x, visible: v } : x)));
                      toast.success(`${c.title} is now ${v ? "visible" : "hidden"} in the store`);
                    }}
                    aria-label={`Show ${c.title} in the store`}
                  />
                </label>
              </div>
              <p className="line-clamp-2 text-[14px] text-subtle">{c.blurb}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => open(c)}>
                  <PencilSimple /> Edit
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <a href={`/collections/${c.slug}`} target="_blank" rel="noreferrer">
                    <ArrowSquareOut /> View
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Sheet open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{isNew ? "New collection" : `Edit ${editing?.title}`}</SheetTitle>
            <SheetDescription>Pick products and set the order they appear in.</SheetDescription>
          </SheetHeader>
          {editing && (
            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-5 px-4 pb-6">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="c-title">Title</Label>
                  <Input id="c-title" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Gifts under $50" />
                  <p className="text-[13px] text-subtle">URL: /collections/{editing.slug || slugify(editing.title) || "..."}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="c-blurb">Description</Label>
                  <Textarea id="c-blurb" rows={3} value={editing.blurb} onChange={(e) => setEditing({ ...editing, blurb: e.target.value })} />
                </div>
                <label className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5 text-[14px]">
                  Show in the store
                  <Switch checked={editing.visible} onCheckedChange={(v) => setEditing({ ...editing, visible: v })} />
                </label>

                <div className="flex flex-col gap-2">
                  <p className="text-[14px] font-medium text-ink">In this collection ({editing.productIds.length})</p>
                  {editing.productIds.length === 0 && <p className="text-[13px] text-subtle">Tick products below to add them.</p>}
                  <ol className="flex flex-col gap-1.5">
                    {editing.productIds.map((id, i) => {
                      const p = adminProducts.find((x) => x.id === id);
                      if (!p) return null;
                      return (
                        <li key={id} className="flex items-center gap-2 rounded-lg bg-surface-2 px-2 py-1.5">
                          <span className="w-5 text-center text-[12px] tabular-nums text-subtle">{i + 1}</span>
                          <span className="relative size-8 shrink-0 overflow-hidden rounded-md">
                            <Image src={p.image} alt="" fill sizes="32px" className="object-cover" />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{p.name}</span>
                          <Button variant="ghost" size="icon-xs" aria-label={`Move ${p.name} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
                          <Button variant="ghost" size="icon-xs" aria-label={`Move ${p.name} down`} disabled={i === editing.productIds.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
                          <Button variant="ghost" size="icon-xs" aria-label={`Remove ${p.name}`} onClick={() => setEditing({ ...editing, productIds: editing.productIds.filter((x) => x !== id) })}><X /></Button>
                        </li>
                      );
                    })}
                  </ol>
                </div>

                <div className="flex flex-col gap-1">
                  <p className="mb-1 text-[14px] font-medium text-ink">All products</p>
                  {products.map((p) => {
                    const checked = editing.productIds.includes(p.id);
                    return (
                      <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) =>
                            setEditing({
                              ...editing,
                              productIds: v ? [...editing.productIds, p.id] : editing.productIds.filter((x) => x !== p.id),
                            })
                          }
                        />
                        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{p.name}</span>
                        <span className="text-[12px] capitalize text-subtle">{p.category}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </ScrollArea>
          )}
          <SheetFooter className="border-t border-line">
            {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditing(null)}>Cancel</Button>
              <Button className="flex-1" onClick={save}>{isNew ? "Create collection" : "Save collection"}</Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

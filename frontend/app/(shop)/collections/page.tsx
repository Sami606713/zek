import type { Metadata } from "next";
import { fetchCollections, mapCollection } from "@/lib/api/catalog";
import { CollectionCard } from "@/components/shop/CollectionCard";
import { Reveal } from "@/components/motion/Reveal";

export const metadata: Metadata = {
  title: "Collections | ZEK",
  description: "Themed edits from the ZEK store: gifts, desk setups, coffee and the latest arrivals.",
};

export const revalidate = 300;

export default async function CollectionsPage() {
  let collections: ReturnType<typeof mapCollection>[] = [];
  try {
    const apiCollections = await fetchCollections();
    collections = apiCollections.map(mapCollection);
  } catch {}

  const [feature, ...rest] = collections;

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-24 pt-24 md:px-8 md:pt-28">
      <Reveal y={16}>
        <h1 className="text-4xl font-semibold tracking-[-0.04em] text-ink md:text-6xl">
          Collections
        </h1>
        <p className="mt-3 max-w-[56ch] text-[16px] text-subtle">
          Themed edits picked by the ZEK team. Start here when you know the occasion but not the product.
        </p>
      </Reveal>

      {feature && (
        <Reveal className="mt-10" delay={0.08}>
          <CollectionCard collection={feature} variant="feature" priority />
        </Reveal>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 md:mt-4 md:grid-cols-2 md:gap-4 lg:grid-cols-[1.35fr_1fr_1fr]">
        {rest.map((collection, i) => (
          <Reveal
            key={collection.slug}
            delay={0.08 * (i + 1)}
            className={i === 0 ? "md:col-span-2 lg:col-span-1" : ""}
          >
            <CollectionCard collection={collection} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}

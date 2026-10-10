import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CaretRight } from "@phosphor-icons/react/ssr";
import { fetchCollectionBySlug, fetchCollections, mapCollectionDetail, mapCollection, mapProductListItem } from "@/lib/api/catalog";
import { CollectionProducts } from "@/components/shop/CollectionProducts";
import { Reveal } from "@/components/motion/Reveal";
import type { Collection, Product } from "@/lib/catalog";

export async function generateMetadata({
  params,
}: PageProps<"/collections/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  try {
    const apiCollection = await fetchCollectionBySlug(slug);
    const collection = mapCollectionDetail(apiCollection);
    return {
      title: `${collection.title} | ZEK`,
      description: collection.blurb,
      openGraph: { images: [collection.image] },
    };
  } catch {
    return { title: "Collection not found | ZEK" };
  }
}

export const revalidate = 300;

export default async function CollectionPage({
  params,
}: PageProps<"/collections/[slug]">) {
  const { slug } = await params;

  let collection: Collection;
  let items: Product[] = [];
  try {
    const apiCollection = await fetchCollectionBySlug(slug);
    collection = mapCollectionDetail(apiCollection);
    items = apiCollection.products.map(mapProductListItem);
  } catch {
    notFound();
  }

  let others: Collection[] = [];
  try {
    const apiOthers = await fetchCollections();
    others = apiOthers.filter((c) => c.slug !== slug).map(mapCollection);
  } catch {}

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-24 pt-24 md:px-8 md:pt-28">
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex items-center gap-1.5 text-[13px] text-subtle">
          <li>
            <Link href="/collections" className="hover:text-ink">
              Collections
            </Link>
          </li>
          <li aria-current="page" className="flex min-w-0 items-center gap-1.5 text-ink">
            <CaretRight size={12} aria-hidden className="shrink-0 text-subtle" />
            <span className="truncate">{collection.title}</span>
          </li>
        </ol>
      </nav>

      <Reveal y={20}>
        <header className="relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-panel bg-surface-2 sm:aspect-[16/9] lg:aspect-[21/8]">
          <Image
            src={collection.image}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e0f12]/85 via-[#0e0f12]/25 to-transparent" />
          <div className="relative p-6 md:p-10">
            <h1 className="max-w-[18ch] text-4xl font-semibold tracking-[-0.045em] text-[#f4f5f7] md:text-6xl">
              {collection.title}
            </h1>
            <p className="mt-3 max-w-[52ch] text-[16px] leading-relaxed text-[#f4f5f7]/80">
              {collection.blurb}
            </p>
          </div>
        </header>
      </Reveal>

      <div className="mt-12">
        <CollectionProducts products={items} />
      </div>

      <section aria-labelledby="more-collections" className="mt-24">
        <div className="flex items-end justify-between gap-4">
          <h2
            id="more-collections"
            className="text-3xl font-semibold tracking-[-0.04em] text-ink md:text-4xl"
          >
            More collections
          </h2>
          <Link
            href="/collections"
            className="group hidden items-center gap-1.5 text-[15px] font-medium text-ink sm:inline-flex"
          >
            See all
            <ArrowRight
              size={16}
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          </Link>
        </div>

        <ul className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
          {others.map((c, i) => (
            <li key={c.slug}>
              <Reveal delay={i * 0.06} y={16}>
                <Link
                  href={`/collections/${c.slug}`}
                  className="group flex items-center gap-4 rounded-panel bg-surface p-3 transition hover:bg-surface-2"
                >
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-[14px] bg-surface-2">
                    <Image
                      src={c.image}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-medium text-ink">{c.title}</p>
                    <p className="mt-0.5 text-[14px] text-subtle">
                      {c.productIds.length} products
                    </p>
                  </div>
                  <ArrowRight
                    size={18}
                    className="mr-2 shrink-0 text-subtle transition-transform duration-300 group-hover:translate-x-1 group-hover:text-ink"
                  />
                </Link>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

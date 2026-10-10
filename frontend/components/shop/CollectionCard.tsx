import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { collectionProducts, type Collection } from "@/lib/catalog";

type CollectionCardProps = {
  collection: Collection;
  variant?: "feature" | "tile";
  priority?: boolean;
};

export function CollectionCard({
  collection,
  variant = "tile",
  priority = false,
}: CollectionCardProps) {
  const items = collectionProducts(collection);
  const feature = variant === "feature";

  return (
    <Link
      href={`/collections/${collection.slug}`}
      className={`group relative flex h-full flex-col justify-end overflow-hidden rounded-panel bg-surface-2 ${
        feature
          ? "aspect-[4/5] sm:aspect-[16/10] lg:aspect-[16/7]"
          : "aspect-[4/5] lg:aspect-auto lg:min-h-[520px]"
      }`}
    >
      <Image
        src={collection.image}
        alt=""
        fill
        priority={priority}
        sizes={feature ? "100vw" : "(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"}
        className="object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.05]"
      />
      <div
        className={`absolute inset-0 ${
          feature
            ? "bg-gradient-to-t from-[#0e0f12]/85 via-[#0e0f12]/30 to-transparent lg:bg-gradient-to-r lg:from-[#0e0f12]/80 lg:via-[#0e0f12]/35"
            : "bg-gradient-to-t from-[#0e0f12]/90 via-[#0e0f12]/45 to-[#0e0f12]/5"
        }`}
      />

      <div
        className={`relative flex flex-col gap-5 p-6 md:p-8 ${
          feature ? "lg:max-w-[46%] lg:justify-center lg:p-12" : ""
        }`}
      >
        <div>
          <p className="text-[13px] font-medium text-[#f4f5f7]/75">
            {items.length} products
          </p>
          <h2
            className={`mt-2 font-semibold tracking-[-0.04em] text-[#f4f5f7] ${
              feature ? "text-4xl md:text-5xl" : "text-3xl"
            }`}
          >
            {collection.title}
          </h2>
          <p
            className={`mt-3 max-w-[44ch] leading-relaxed text-[#f4f5f7]/80 ${
              feature ? "text-[16px]" : "text-[15px]"
            }`}
          >
            {collection.blurb}
          </p>
        </div>

        <div className={`flex items-center ${feature ? "gap-5" : "justify-between gap-4"}`}>
          <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-[#f4f5f7] px-5 py-2.5 text-[14px] font-medium text-[#121316] transition-transform duration-300 group-active:scale-[0.98]">
            Shop the collection
            <ArrowRight
              size={14}
              weight="bold"
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          </span>

          <ul className="flex shrink-0 -space-x-3" aria-hidden>
            {items.slice(0, 3).map((p) => (
              <li
                key={p.id}
                className="relative size-11 overflow-hidden rounded-full border-2 border-[#f4f5f7] bg-surface-2"
              >
                <Image src={p.image} alt="" fill sizes="44px" className="object-cover" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Link>
  );
}

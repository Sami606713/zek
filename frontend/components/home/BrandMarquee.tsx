// Sample brand roster for the hackathon build. Logos from Simple Icons, tinted with
// currentColor through a CSS mask so they follow light and dark mode.
const brands = [
  { slug: "sony", name: "Sony", wide: true },
  { slug: "samsung", name: "Samsung", wide: true },
  { slug: "nike", name: "Nike" },
  { slug: "bose", name: "Bose", wide: true },
  { slug: "adidas", name: "Adidas" },
  { slug: "apple", name: "Apple" },
  { slug: "jbl", name: "JBL" },
  { slug: "puma", name: "Puma" },
];

function BrandLogo({
  slug,
  name,
  wide = false,
  duplicate,
}: {
  slug: string;
  name: string;
  wide?: boolean;
  duplicate: boolean;
}) {
  const url = `url(https://cdn.simpleicons.org/${slug})`;
  return (
    <li
      aria-hidden={duplicate || undefined}
      className="flex h-16 w-36 shrink-0 items-center justify-center md:w-44"
    >
      <span
        role="img"
        aria-label={name}
        className={`block bg-ink ${wide ? "h-14 w-32" : "h-8 w-24"} opacity-60 transition-opacity duration-300 hover:opacity-100`}
        style={{
          maskImage: url,
          WebkitMaskImage: url,
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskPosition: "center",
          WebkitMaskPosition: "center",
          maskSize: "contain",
          WebkitMaskSize: "contain",
        }}
      />
    </li>
  );
}

export function BrandMarquee() {
  return (
    <section aria-label="Brands available on ZEK" className="border-y border-line py-6">
      <div className="group relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
        <ul className="animate-marquee flex w-max">
          {[...brands, ...brands].map((brand, i) => (
            <BrandLogo
              key={`${brand.slug}-${i}`}
              {...brand}
              duplicate={i >= brands.length}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretRight } from "@phosphor-icons/react/ssr";
import { fetchProductBySlug, fetchProducts, fetchRelatedProducts, mapProductDetail, mapProductListItem } from "@/lib/api/catalog";
import { ProductDetail } from "@/components/shop/ProductDetail";
import { ProductRail } from "@/components/home/ProductRail";
import type { Product } from "@/lib/catalog";

// Product pages show stock, so they refresh every minute (cacheComponents replaces `revalidate`).
const PRODUCT_CACHE = { revalidate: 60 };

// Prerender the live catalogue (cacheComponents needs at least one real param);
// products added later still render on their first visit.
export async function generateStaticParams() {
  try {
    const products = await fetchProducts({ limit: 100 });
    if (products.length) return products.map((p) => ({ id: p.slug }));
  } catch {}
  return [{ id: "folio-reader" }]; // API unreachable at build time: one known slug keeps the build valid
}

export async function generateMetadata({
  params,
}: PageProps<"/products/[id]">): Promise<Metadata> {
  "use cache";
  cacheLife(PRODUCT_CACHE);
  const { id } = await params;
  try {
    const apiProduct = await fetchProductBySlug(id);
    const product = mapProductDetail(apiProduct);
    return {
      title: `${product.name} | ZEK`,
      description: product.description,
      openGraph: { images: [product.image] },
    };
  } catch {
    return { title: "Product not found | ZEK" };
  }
}

export default async function ProductPage({ params }: PageProps<"/products/[id]">) {
  "use cache";
  cacheLife(PRODUCT_CACHE);
  const { id } = await params;

  let product: Product;
  try {
    const apiProduct = await fetchProductBySlug(id);
    product = mapProductDetail(apiProduct);
  } catch {
    notFound();
  }

  let related: Product[] = [];
  try {
    const apiRelated = await fetchRelatedProducts(id, 6);
    related = apiRelated.map(mapProductListItem);
  } catch {}

  const categorySlug = product.category;

  return (
    <>
      <div className="mx-auto max-w-[1400px] px-4 pt-24 md:px-8 md:pt-28">
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-subtle">
            <li>
              <Link href="/products" className="hover:text-ink">
                Shop
              </Link>
            </li>
            {categorySlug && (
              <li className="flex items-center gap-1.5">
                <CaretRight size={12} aria-hidden />
                <Link href={`/products?category=${categorySlug}`} className="hover:text-ink">
                  {categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1)}
                </Link>
              </li>
            )}
            <li aria-current="page" className="flex min-w-0 items-center gap-1.5 text-ink">
              <CaretRight size={12} aria-hidden className="shrink-0 text-subtle" />
              <span className="truncate">{product.name}</span>
            </li>
          </ol>
        </nav>

        <ProductDetail product={product} />
      </div>

      <ProductRail title="You may also like" products={related} />
    </>
  );
}

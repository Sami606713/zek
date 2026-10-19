import { api } from "./client";
import { fetchProductBySlug } from "./catalog";
import type { ApiWishlist } from "./types";

// The site refers to products by slug; the wishlist API by product id. This keeps the
// pairs we've seen so adding or removing doesn't have to look a product up twice.
const idBySlug = new Map<string, string>();

async function productId(slug: string): Promise<string> {
  const known = idBySlug.get(slug);
  if (known) return known;
  const { id } = await fetchProductBySlug(slug);
  idBySlug.set(slug, id);
  return id;
}

/** The signed-in shopper's saved products, newest first, as slugs. */
export async function fetchWishlistSlugs(): Promise<string[]> {
  const data = await api.get<ApiWishlist>("/me/wishlist", { auth: true });
  return data.items.map(({ product }) => {
    idBySlug.set(product.slug, product.id);
    return product.slug;
  });
}

export async function addToWishlist(slug: string): Promise<void> {
  await api.post<void>("/me/wishlist", { product_id: await productId(slug) }, { auth: true });
}

export async function removeFromWishlist(slug: string): Promise<void> {
  await api.delete<void>(`/me/wishlist/${await productId(slug)}`, { auth: true });
}

export async function clearWishlist(): Promise<void> {
  await api.delete<void>("/me/wishlist", { auth: true });
}

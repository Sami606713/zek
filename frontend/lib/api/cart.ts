import { api } from "./client";
import { fetchProductBySlug } from "./catalog";
import { mapCart } from "./mappers";
import type { ApiCart } from "./types";
import type { CartLine } from "@/store/cartStore";

export async function fetchCart(): Promise<{ lines: CartLine[]; promo: string | null }> {
  const cart = await api.get<ApiCart>("/cart", { guest: true });
  return mapCart(cart);
}

export async function addToCart(variantId: string, quantity = 1): Promise<{ lines: CartLine[]; promo: string | null }> {
  const cart = await api.post<ApiCart>("/cart/items", { variant_id: variantId, quantity }, { guest: true });
  return mapCart(cart);
}

export async function updateCartItem(itemId: string, quantity: number): Promise<{ lines: CartLine[]; promo: string | null }> {
  const cart = await api.patch<ApiCart>(`/cart/items/${itemId}`, { quantity }, { guest: true });
  return mapCart(cart);
}

export async function removeCartItem(itemId: string): Promise<{ lines: CartLine[]; promo: string | null }> {
  const cart = await api.delete<ApiCart>(`/cart/items/${itemId}`, { guest: true });
  return mapCart(cart);
}

export async function clearCart(): Promise<{ lines: CartLine[]; promo: string | null }> {
  const cart = await api.delete<ApiCart>("/cart", { guest: true });
  return mapCart(cart);
}

export async function applyDiscount(code: string): Promise<{ lines: CartLine[]; promo: string | null }> {
  const cart = await api.post<ApiCart>("/cart/discount", { code }, { guest: true });
  return mapCart(cart);
}

export async function removeDiscount(): Promise<{ lines: CartLine[]; promo: string | null }> {
  const cart = await api.delete<ApiCart>("/cart/discount", { guest: true });
  return mapCart(cart);
}

/** Move the guest cart (this browser's session) into the signed-in account's cart. */
export async function mergeCart(): Promise<{ lines: CartLine[]; promo: string | null }> {
  const cart = await api.post<ApiCart>("/cart/merge", undefined, { auth: true, guest: true });
  return mapCart(cart);
}

/**
 * The variant to add when a button only knows the product (quick add, wishlist,
 * buy again): the one in the requested color if given, else the first in stock.
 */
export async function resolveVariantId(slug: string, color?: string): Promise<string | null> {
  const product = await fetchProductBySlug(slug);
  const buyable = product.variants.filter((v) => v.is_active && v.stock_qty > 0);
  const match = color ? buyable.find((v) => v.color_name === color || v.size === color) : undefined;
  return (match ?? buyable[0])?.id ?? null;
}

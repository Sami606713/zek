import { api } from "./client";
import { mapWishlistProduct } from "./mappers";
import type { ApiWishlist, ApiWishlistItem } from "./types";
import type { Product } from "@/lib/catalog";

export async function fetchWishlist(): Promise<Product[]> {
  const data = await api.get<ApiWishlist>("/me/wishlist", { auth: true });
  return data.items.map(mapWishlistProduct);
}

export async function fetchWishlistIds(): Promise<string[]> {
  const data = await api.get<{ ids: string[] }>("/me/wishlist/ids", { auth: true });
  return data.ids;
}

export async function addToWishlist(productId: string): Promise<Product[]> {
  const data = await api.post<ApiWishlist>("/me/wishlist", { product_id: productId }, { auth: true });
  return data.items.map(mapWishlistProduct);
}

export async function removeFromWishlist(productId: string): Promise<void> {
  await api.delete<void>(`/me/wishlist/${productId}`, { auth: true });
}

export async function clearWishlist(): Promise<void> {
  await api.delete<void>("/me/wishlist", { auth: true });
}

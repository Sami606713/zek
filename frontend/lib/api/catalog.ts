import { api } from "./client";
import { mapProductListItem, mapProductDetail, mapCategory, mapCollection, mapCollectionDetail } from "./mappers";
import type { ApiProductListItem, ApiProductDetail, ApiCategory, ApiCollection, ApiCollectionDetail } from "./types";

export interface ProductFilters {
  category?: string;
  q?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  onSale?: boolean;
  inStock?: boolean;
  featured?: boolean;
  sort?: string;
  skip?: number;
  limit?: number;
}

function buildQueryString(filters: ProductFilters): string {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.q) params.set("q", filters.q);
  if (filters.brand) params.set("brand", filters.brand);
  if (filters.minPrice != null) params.set("min_price", String(filters.minPrice));
  if (filters.maxPrice != null) params.set("max_price", String(filters.maxPrice));
  if (filters.minRating != null) params.set("min_rating", String(filters.minRating));
  if (filters.onSale != null) params.set("on_sale", String(filters.onSale));
  if (filters.inStock != null) params.set("in_stock", String(filters.inStock));
  if (filters.featured != null) params.set("featured", String(filters.featured));
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.skip != null) params.set("skip", String(filters.skip));
  if (filters.limit != null) params.set("limit", String(filters.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export async function fetchProducts(filters: ProductFilters = {}): Promise<ApiProductListItem[]> {
  const data = await api.get<{ items: ApiProductListItem[] }>(`/products${buildQueryString(filters)}`);
  return data.items;
}

export async function fetchProductBySlug(slug: string): Promise<ApiProductDetail> {
  return api.get<ApiProductDetail>(`/products/${slug}`);
}

export async function fetchRelatedProducts(slug: string, limit = 6): Promise<ApiProductListItem[]> {
  return api.get<ApiProductListItem[]>(`/products/${slug}/related?limit=${limit}`);
}

export async function fetchCategories(): Promise<ApiCategory[]> {
  const data = await api.get<{ items: ApiCategory[] }>("/categories");
  return data.items;
}

export async function fetchCategoryBySlug(slug: string): Promise<ApiCategory> {
  return api.get<ApiCategory>(`/categories/${slug}`);
}

export async function fetchCollections(): Promise<ApiCollection[]> {
  const data = await api.get<{ items: ApiCollection[] }>("/collections");
  return data.items;
}

export async function fetchCollectionBySlug(slug: string): Promise<ApiCollectionDetail> {
  return api.get<ApiCollectionDetail>(`/collections/${slug}`);
}

export { mapProductListItem, mapProductDetail, mapCategory, mapCollection, mapCollectionDetail };

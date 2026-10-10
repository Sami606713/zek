import type { Product } from "./catalog";

export const sortOptions = [
  { value: "featured", label: "Featured" },
  { value: "new", label: "Newest" },
  { value: "price-asc", label: "Price, low to high" },
  { value: "price-desc", label: "Price, high to low" },
  { value: "rating", label: "Top rated" },
] as const;

export const priceOptions = [
  { value: "u50", label: "Under $50", min: 0, max: 50 },
  { value: "50-100", label: "$50 to $100", min: 50, max: 100 },
  { value: "100-250", label: "$100 to $250", min: 100, max: 250 },
  { value: "250p", label: "$250 and up", min: 250, max: Infinity },
] as const;

export const ratingOptions = [
  { value: "4", label: "4 stars and up", min: 4 },
  { value: "4.5", label: "4.5 stars and up", min: 4.5 },
] as const;

export type Filters = {
  q: string;
  category: string;
  sort: string;
  price: string;
  rating: string;
  sale: boolean;
  fresh: boolean;
};

export const readFilters = (params: URLSearchParams): Filters => ({
  q: params.get("q") ?? "",
  category: params.get("category") ?? "",
  sort: params.get("sort") ?? "featured",
  price: params.get("price") ?? "",
  rating: params.get("rating") ?? "",
  sale: params.get("sale") === "1",
  fresh: params.get("new") === "1",
});

export const countActiveFilters = (f: Filters) =>
  [f.price, f.rating, f.sale, f.fresh].filter(Boolean).length;

export function applyFilters(products: Product[], f: Filters) {
  const q = f.q.trim().toLowerCase();
  const price = priceOptions.find((p) => p.value === f.price);
  const rating = ratingOptions.find((r) => r.value === f.rating);

  const result = products.filter((p) => {
    if (f.category && p.category !== f.category) return false;
    if (q && !`${p.name} ${p.brand} ${p.category}`.toLowerCase().includes(q)) return false;
    if (price && (p.price < price.min || p.price >= price.max)) return false;
    if (rating && p.rating < rating.min) return false;
    if (f.sale && !p.compareAt) return false;
    if (f.fresh && p.tag !== "New") return false;
    return true;
  });

  switch (f.sort) {
    case "new":
      return result.sort((a, b) => b.addedOn.localeCompare(a.addedOn));
    case "price-asc":
      return result.sort((a, b) => a.price - b.price);
    case "price-desc":
      return result.sort((a, b) => b.price - a.price);
    case "rating":
      return result.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
    default:
      return result;
  }
}

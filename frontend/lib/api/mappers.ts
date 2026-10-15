import type { Product, Category, Collection } from "@/lib/catalog";
import type { SessionUser } from "@/store/userStore";
import type { Order, OrderLine } from "@/store/orderStore";
import type { Address } from "@/store/addressStore";
import type { CartLine } from "@/store/cartStore";
import type { Delivery } from "@/lib/pricing";
import type {
  ApiUser,
  ApiProductListItem,
  ApiProductDetail,
  ApiCategory,
  ApiCollection,
  ApiCollectionDetail,
  ApiCart,
  ApiCartItem,
  ApiOrder,
  ApiAddress,
  ApiWishlistItem,
} from "./types";

export function mapUser(u: ApiUser): SessionUser {
  return {
    id: u.id,
    fullName: u.full_name ?? u.username,
    username: u.username,
    email: u.email,
    phone: u.phone_number ?? undefined,
    createdAt: u.created_at,
    role: u.role,
    isAdmin: u.role === "admin" || u.is_superuser,
  };
}

export function mapProductListItem(p: ApiProductListItem): Product {
  const image = p.image?.url ?? p.image_url ?? "";
  return {
    id: p.slug,
    name: p.name,
    brand: p.brand,
    category: (p.category?.slug ?? p.category_slug) as Product["category"],
    price: parseFloat(p.price),
    compareAt: p.compare_at_price ? parseFloat(p.compare_at_price) : undefined,
    image,
    gallery: image ? [image] : [],
    rating: p.rating_avg,
    reviews: p.review_count,
    stock: p.total_stock ?? 0,
    addedOn: new Date().toISOString().slice(0, 10),
    description: "",
    details: [],
    colors: p.colors ?? [],
  };
}

export function mapProductDetail(p: ApiProductDetail): Product {
  const variants = p.variants ?? [];
  const colors = [...new Set(variants.map((v) => v.color_name).filter(Boolean))] as string[];
  return {
    id: p.slug,
    name: p.name,
    brand: p.brand,
    category: p.category?.slug as Product["category"],
    price: parseFloat(p.price),
    compareAt: p.compare_at_price ? parseFloat(p.compare_at_price) : undefined,
    image: p.images[0]?.url ?? "",
    gallery: p.images.map((i) => i.url),
    rating: p.rating_avg,
    reviews: p.review_count,
    stock: variants.reduce((s, v) => s + v.stock_qty, 0),
    addedOn: p.created_at.slice(0, 10),
    description: p.description,
    details: p.details ?? [],
    colors: colors.map((name) => ({ name, hex: "#999" })),
  };
}

export function mapCategory(c: ApiCategory): Category {
  return {
    slug: c.slug as Category["slug"],
    name: c.name,
    blurb: c.description ?? "",
    image: c.image_url ?? "",
  };
}

export function mapCollection(c: ApiCollection): Collection {
  return {
    slug: c.slug,
    title: c.title,
    blurb: c.description ?? "",
    image: c.image_url ?? "",
    productIds: [],
  };
}

export function mapCollectionDetail(c: ApiCollectionDetail): Collection {
  return {
    slug: c.slug,
    title: c.title,
    blurb: c.description ?? "",
    image: c.image_url ?? "",
    productIds: c.products.map((p) => p.slug),
  };
}

export function mapCartItem(item: ApiCartItem): CartLine {
  return {
    key: item.id,
    id: item.slug ?? item.product_slug ?? "",
    color: item.color_name ?? undefined,
    quantity: item.quantity,
    product: {
      name: item.name ?? item.product_name ?? "",
      brand: item.brand ?? "",
      image: item.image_url ?? "",
      price: parseFloat(item.unit_price),
      compareAt: item.compare_at_price ? parseFloat(item.compare_at_price) : undefined,
    },
  };
}

export function mapCart(cart: ApiCart): { lines: CartLine[]; promo: string | null } {
  return {
    lines: cart.items.map(mapCartItem),
    promo: cart.discount_code,
  };
}

export function mapOrder(o: ApiOrder): Order {
  const lines: OrderLine[] = o.items.map((item) => ({
    id: item.id,
    name: item.product_name,
    brand: "",
    image: item.image_url ?? "",
    color: item.color_name ?? undefined,
    quantity: item.quantity,
    price: parseFloat(item.unit_price),
  }));

  return {
    id: o.order_number,
    createdAt: o.created_at,
    email: o.email,
    address: {
      name: o.shipping_address.name,
      line1: o.shipping_address.line1,
      line2: o.shipping_address.line2,
      city: o.shipping_address.city,
      region: o.shipping_address.region,
      postal: o.shipping_address.postal,
      country: o.shipping_address.country,
    },
    delivery: (o.delivery_method as Delivery) ?? "standard",
    payment: { method: "card", last4: "4242" },
    lines,
    totals: {
      subtotal: parseFloat(o.subtotal),
      discount: parseFloat(o.discount_total),
      shipping: parseFloat(o.shipping_total),
      tax: parseFloat(o.tax_total),
      total: parseFloat(o.total),
    },
    promo: null,
  };
}

export function mapAddress(a: ApiAddress): Address {
  return {
    id: a.id,
    label: a.label,
    name: a.full_name,
    line1: a.line1,
    line2: a.line2 ?? undefined,
    city: a.city,
    region: a.region,
    postal: a.postal_code,
    country: a.country,
    phone: a.phone_number ?? undefined,
  };
}

export function mapWishlistProduct(item: ApiWishlistItem): Product {
  return mapProductListItem(item.product);
}

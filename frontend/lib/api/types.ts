export interface ApiUser {
  id: string;
  username: string;
  email: string;
  full_name: string | null;
  phone_number: string | null;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  is_superuser: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApiToken {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface ApiCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  image_url: string | null;
}

export interface ApiProductListItem {
  id: string;
  slug: string;
  name: string;
  brand: string;
  price: string;
  compare_at_price: string | null;
  // Backend sends nested objects; the flat fields are kept for compatibility.
  image?: { url: string } | null;
  category?: { slug: string; name: string } | null;
  colors?: { name: string; hex: string }[];
  total_stock?: number;
  image_url?: string | null;
  category_slug?: string;
  category_name?: string;
  rating_avg: number;
  review_count: number;
  is_featured: boolean;
  status: string;
  default_variant_id: string | null;
}

export interface ApiProductVariant {
  id: string;
  sku: string;
  color_name: string | null;
  size: string | null;
  price: string;
  stock_qty: number;
  is_active: boolean;
}

export interface ApiProductImage {
  id: string;
  url: string;
  alt_text: string | null;
  position: number;
}

export interface ApiProductDetail {
  id: string;
  slug: string;
  name: string;
  brand: string;
  description: string;
  details: string[];
  price: string;
  compare_at_price: string | null;
  /** The API sends `category: { slug, name }` (null when the product has none). */
  category: { slug: string; name: string } | null;
  images: ApiProductImage[];
  variants: ApiProductVariant[];
  rating_avg: number;
  review_count: number;
  is_featured: boolean;
  status: string;
  created_at: string;
}

export interface ApiCollection {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  image_url: string | null;
  is_published: boolean;
  product_count: number;
}

export interface ApiCollectionDetail {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  image_url: string | null;
  is_published: boolean;
  products: ApiProductListItem[];
}

export interface ApiCartItem {
  id: string;
  variant_id: string;
  product_id: string;
  // Backend CartLine fields
  name?: string;
  slug?: string;
  brand?: string | null;
  compare_at_price?: string | null;
  max_quantity?: number;
  // Older field names, kept for compatibility
  product_name?: string;
  product_slug?: string;
  image_url: string | null;
  color_name: string | null;
  size: string | null;
  quantity: number;
  unit_price: string;
  line_total: string;
}

export interface ApiCart {
  id: string;
  items: ApiCartItem[];
  item_count: number;
  subtotal: string;
  discount_code: string | null;
  discount_total: string;
  shipping_total: string;
  tax_total: string;
  total: string;
}

export interface ApiAddress {
  id: string;
  label: string;
  full_name: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  phone_number: string | null;
  is_default: boolean;
}

export interface ApiOrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  image_url: string | null;
  variant_id: string | null;
  color_name: string | null;
  size: string | null;
  quantity: number;
  unit_price: string;
  line_total: string;
}

export interface ApiOrder {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  email: string;
  shipping_address: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    region: string;
    postal: string;
    country: string;
  };
  delivery_method: string;
  items: ApiOrderItem[];
  subtotal: string;
  discount_total: string;
  shipping_total: string;
  tax_total: string;
  total: string;
  created_at: string;
  updated_at: string;
  packed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  status_history: { from_status: string | null; to_status: string; note: string | null; created_at: string }[];
}

export interface ApiWishlistItem {
  id: string;
  product_id: string;
  variant_id: string | null;
  product: ApiProductListItem;
}

export interface ApiWishlist {
  items: ApiWishlistItem[];
  count: number;
}

export interface ApiDiscount {
  code: string;
  type: string;
  value: number;
  description: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
}

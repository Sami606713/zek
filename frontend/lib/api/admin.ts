// Admin API: every call needs an admin token (the backend checks `require_admin`).
// Types come from lib/api/schema.d.ts, generated from the backend's OpenAPI spec
// with `npm run api:types`, so they always match the real responses.
import { api, upload } from "./client";
import type { components, paths } from "./schema";

type Schemas = components["schemas"];
type Query<P extends keyof paths, M extends "get"> = paths[P][M] extends { parameters: { query?: infer Q } }
  ? NonNullable<Q>
  : never;

// ── Shapes ──────────────────────────────────────────────────────────────────

export type Page<T> = { items: T[]; total: number; skip: number; limit: number };

export type AdminOrderRow = Schemas["AdminOrderRow"];
export type AdminOrderDetail = Schemas["OrderAdminResponse"];
export type AdminOrderUpdate = Schemas["OrderAdminUpdate"];
export type RefundCreate = Schemas["RefundCreate"];
export type OrderStatus = Schemas["OrderStatus"];
export type PaymentStatus = Schemas["PaymentStatus"];

export type AdminProductRow = Schemas["ProductListResponse"]["items"][number];
export type AdminProductDetail = Schemas["ProductAdminDetail"];
export type ProductCreate = Schemas["ProductCreate"];
export type ProductUpdate = Schemas["ProductUpdate"];
export type VariantCreate = Schemas["VariantCreate"];
export type VariantUpdate = Schemas["VariantUpdate"];
export type StockAdjust = Schemas["StockAdjust"];
export type ProductImage = Schemas["ImageResponse"];

export type AdminCategoryRow = Schemas["CategoryListResponse"]["items"][number];
export type AdminCategoryDetail = Schemas["CategoryDetail"];
export type CategoryCreate = Schemas["CategoryCreate"];
export type CategoryUpdate = Schemas["CategoryUpdate"];

export type AdminCollectionRow = Schemas["CollectionListResponse"]["items"][number];
export type AdminCollectionDetail = Schemas["CollectionAdminDetail"];
export type CollectionCreate = Schemas["CollectionCreate"];
export type CollectionUpdate = Schemas["CollectionUpdate"];

export type AdminDiscountRow = Schemas["DiscountResponse"];
export type AdminDiscountDetail = Schemas["DiscountDetail"];
export type DiscountCreate = Schemas["DiscountCreate"];
export type DiscountUpdate = Schemas["DiscountUpdate"];

export type InventoryRow = Schemas["InventoryRow"];
export type InventoryResponse = Schemas["InventoryResponse"];
export type StockLevel = Schemas["StockLevel"];
export type ProductStatus = Schemas["ProductStatus"];
export type ProductSort = Schemas["ProductSort"];

export type CustomerRow = Schemas["CustomerRow"];
export type CustomerDetail = Schemas["CustomerDetail"];
export type CustomerListResponse = Schemas["CustomerListResponse"];
export type CustomerSegment = Schemas["CustomerSegment"];
export type CustomerSort = Schemas["CustomerSort"];
export type CustomerAccessUpdate = Schemas["CustomerAccessUpdate"];

export type DashboardStats = Schemas["DashboardStats"];
export type PeriodTotals = Schemas["PeriodTotals"];

export type AdminUser = Schemas["UserResponse"];
export type AdminUserUpdate = Schemas["UserUpdate"];

export type OrderListQuery = Query<"/api/v1/admin/orders", "get">;
export type ProductListQuery = Query<"/api/v1/products", "get">;
export type CategoryListQuery = Query<"/api/v1/categories", "get">;
export type CollectionListQuery = Query<"/api/v1/collections", "get">;
export type DiscountListQuery = Query<"/api/v1/discounts", "get">;
export type UserListQuery = Query<"/api/v1/users", "get">;
export type CustomerListQuery = Query<"/api/v1/admin/customers", "get">;
export type InventoryQuery = Query<"/api/v1/admin/inventory", "get">;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** `?a=1&b=x` from an object, skipping empty values. */
export function qs(query: object = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

const opts = { auth: true } as const;

// ── Orders ──────────────────────────────────────────────────────────────────

export const adminOrders = {
  list: (query?: OrderListQuery) => api.get<Page<AdminOrderRow>>(`/admin/orders${qs(query)}`, opts),
  get: (id: string) => api.get<AdminOrderDetail>(`/admin/orders/${id}`, opts),
  update: (id: string, body: AdminOrderUpdate) => api.patch<AdminOrderDetail>(`/admin/orders/${id}`, body, opts),
  refund: (id: string, body: RefundCreate) => api.post<AdminOrderDetail>(`/admin/orders/${id}/refunds`, body, opts),
};

// ── Products, variants, stock, images ───────────────────────────────────────

export const adminProducts = {
  list: (query?: ProductListQuery) =>
    api.get<Page<AdminProductRow>>(`/products${qs({ include_unpublished: true, ...query })}`, opts),
  get: (id: string) => api.get<AdminProductDetail>(`/products/id/${id}`, opts),
  create: (body: ProductCreate) => api.post<AdminProductDetail>("/products", body, opts),
  update: (id: string, body: ProductUpdate) => api.patch<AdminProductDetail>(`/products/${id}`, body, opts),
  remove: (id: string) => api.delete<void>(`/products/${id}`, opts),

  addVariant: (id: string, body: VariantCreate) =>
    api.post<AdminProductDetail>(`/products/${id}/variants`, body, opts),
  updateVariant: (id: string, variantId: string, body: VariantUpdate) =>
    api.patch<AdminProductDetail>(`/products/${id}/variants/${variantId}`, body, opts),
  removeVariant: (id: string, variantId: string) =>
    api.delete<AdminProductDetail>(`/products/${id}/variants/${variantId}`, opts),
  adjustStock: (id: string, variantId: string, body: StockAdjust) =>
    api.patch<Schemas["VariantResponse"]>(`/products/${id}/variants/${variantId}/stock`, body, opts),

  uploadImage: (id: string, file: File, extra: Record<string, string> = {}) =>
    upload<ProductImage>(`/products/${id}/images`, { file, ...extra }),
  addImageUrl: (id: string, body: Schemas["ImageFromUrl"]) =>
    api.post<ProductImage>(`/products/${id}/images/url`, body, opts),
  reorderImages: (id: string, body: Schemas["ImageOrder"]) =>
    api.put<ProductImage[]>(`/products/${id}/images/order`, body, opts),
  updateImage: (id: string, imageId: string, body: Schemas["ImageUpdate"]) =>
    api.patch<ProductImage>(`/products/${id}/images/${imageId}`, body, opts),
  removeImage: (id: string, imageId: string) => api.delete<void>(`/products/${id}/images/${imageId}`, opts),
};

// ── Inventory (one row per variant) ─────────────────────────────────────────

export const adminInventory = {
  list: (query?: InventoryQuery) => api.get<InventoryResponse>(`/admin/inventory${qs(query)}`, opts),
  /** Set an exact count; the reason goes to the audit log. */
  setStock: (productId: string, variantId: string, count: number, reason = "Inventory count") =>
    adminProducts.adjustStock(productId, variantId, { set_to: count, reason }),
};

// ── Categories ──────────────────────────────────────────────────────────────

export const adminCategories = {
  list: (query?: CategoryListQuery) =>
    api.get<Page<AdminCategoryRow>>(`/categories${qs({ include_inactive: true, ...query })}`, opts),
  get: (id: string) => api.get<AdminCategoryDetail>(`/categories/id/${id}`, opts),
  create: (body: CategoryCreate) => api.post<AdminCategoryDetail>("/categories", body, opts),
  update: (id: string, body: CategoryUpdate) => api.patch<AdminCategoryDetail>(`/categories/${id}`, body, opts),
  remove: (id: string) => api.delete<void>(`/categories/${id}`, opts),
};

// ── Collections ─────────────────────────────────────────────────────────────

export const adminCollections = {
  list: (query?: CollectionListQuery) =>
    api.get<Page<AdminCollectionRow>>(`/collections${qs({ include_unpublished: true, ...query })}`, opts),
  get: (id: string) => api.get<AdminCollectionDetail>(`/collections/id/${id}`, opts),
  create: (body: CollectionCreate) => api.post<AdminCollectionDetail>("/collections", body, opts),
  update: (id: string, body: CollectionUpdate) => api.patch<AdminCollectionDetail>(`/collections/${id}`, body, opts),
  remove: (id: string) => api.delete<void>(`/collections/${id}`, opts),

  setProducts: (id: string, body: Schemas["CollectionProductsSet"]) =>
    api.put<AdminCollectionDetail>(`/collections/${id}/products`, body, opts),
  addProduct: (id: string, body: Schemas["CollectionProductAdd"]) =>
    api.post<AdminCollectionDetail>(`/collections/${id}/products`, body, opts),
  removeProduct: (id: string, productId: string) =>
    api.delete<AdminCollectionDetail>(`/collections/${id}/products/${productId}`, opts),
  uploadImage: (id: string, file: File) => upload<AdminCollectionDetail>(`/collections/${id}/image`, { file }),
  removeImage: (id: string) => api.delete<AdminCollectionDetail>(`/collections/${id}/image`, opts),
};

// ── Discounts ───────────────────────────────────────────────────────────────

export const adminDiscounts = {
  list: (query?: DiscountListQuery) => api.get<Page<AdminDiscountRow>>(`/discounts${qs(query)}`, opts),
  get: (id: string) => api.get<AdminDiscountDetail>(`/discounts/${id}`, opts),
  create: (body: DiscountCreate) => api.post<AdminDiscountDetail>("/discounts", body, opts),
  update: (id: string, body: DiscountUpdate) => api.patch<AdminDiscountDetail>(`/discounts/${id}`, body, opts),
  remove: (id: string) => api.delete<void>(`/discounts/${id}`, opts),
};

// ── Customers (users) ───────────────────────────────────────────────────────

export const adminUsers = {
  list: (query?: UserListQuery) => api.get<Page<AdminUser>>(`/users${qs(query)}`, opts),
  get: (id: string) => api.get<AdminUser>(`/users/${id}`, opts),
  update: (id: string, body: AdminUserUpdate) => api.patch<AdminUser>(`/users/${id}`, body, opts),
  remove: (id: string) => api.delete<void>(`/users/${id}`, opts),
  unlock: (id: string) => api.post<AdminUser>(`/users/${id}/unlock`, undefined, opts),
};

// ── Customers: accounts with order totals, plus role and access ─────────────

export const adminCustomers = {
  list: (query?: CustomerListQuery) => api.get<CustomerListResponse>(`/admin/customers${qs(query)}`, opts),
  get: (id: string) => api.get<CustomerDetail>(`/admin/customers/${id}`, opts),
  setAccess: (id: string, body: CustomerAccessUpdate) => api.patch<CustomerDetail>(`/admin/customers/${id}/access`, body, opts),
  /** Emails the customer a reset link (the same public endpoint the login page uses). */
  sendPasswordReset: (email: string) => api.post<{ message: string }>("/users/forgot-password", { email }, { auth: false }),
};

// ── Dashboard ───────────────────────────────────────────────────────────────

export const adminStats = {
  /** `tz` buckets the daily chart by the admin's own calendar days. */
  dashboard: (days: 7 | 30 | 90, tz: string) => api.get<DashboardStats>(`/admin/stats${qs({ days, tz })}`, opts),
};

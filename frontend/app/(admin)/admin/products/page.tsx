import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductsTable } from "@/components/admin/products/ProductsTable";

export const metadata: Metadata = { title: "Products" };

export default function AdminProductsPage() {
  return (
    <Suspense>
      <ProductsTable />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductBrowser } from "@/components/shop/ProductBrowser";
import { ProductGridSkeleton } from "@/components/shop/ProductGridSkeleton";

export const metadata: Metadata = {
  title: "Shop all | ZEK",
  description: "Browse every product in the ZEK store. Filter by category, price and rating.",
};

export default function ProductsPage() {
  return (
    <Suspense fallback={<ProductGridSkeleton />}>
      <ProductBrowser />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { EditProduct } from "@/components/admin/products/EditProduct";

export const metadata: Metadata = { title: "Edit product" };

export default function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  return (
    <Suspense>
      <EditProduct params={params} />
    </Suspense>
  );
}

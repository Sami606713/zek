import type { Metadata } from "next";
import { ProductForm } from "@/components/admin/products/ProductForm";

export const metadata: Metadata = { title: "New product" };

export default function NewProductPage() {
  return <ProductForm />;
}

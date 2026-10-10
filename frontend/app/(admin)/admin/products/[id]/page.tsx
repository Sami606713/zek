import type { Metadata } from "next";
import Link from "next/link";
import { adminProducts } from "@/lib/admin/mock";
import { ProductForm } from "@/components/admin/products/ProductForm";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Edit product" };

export function generateStaticParams() {
  return adminProducts.map((p) => ({ id: p.id }));
}

export default async function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  const { id } = await params;
  const product = adminProducts.find((p) => p.id === id);

  if (!product) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-start gap-3 rounded-xl border border-line bg-surface p-8">
        <h1 className="text-xl font-semibold text-ink">Product not found</h1>
        <p className="text-[14px] text-subtle">No product with ID {id}. It may have been deleted.</p>
        <Button asChild variant="outline">
          <Link href="/admin/products">Back to products</Link>
        </Button>
      </div>
    );
  }

  return <ProductForm product={product} />;
}

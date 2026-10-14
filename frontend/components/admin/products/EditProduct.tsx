"use client";

import Link from "next/link";
import { use, useState } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/admin/states";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { ApiError } from "@/lib/api/client";
import { adminProducts } from "@/lib/api/admin";
import { ProductForm } from "./ProductForm";

export function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const product = useAdminQuery(`product:${id}`, () => adminProducts.get(id));
  // Bumped after a form save so the form reloads its fields from the server.
  // Image changes refetch without it, so unsaved form edits survive them.
  const [version, setVersion] = useState(0);

  if (product.loading) return <FormSkeleton />;
  if (!product.data) {
    const missing = product.error instanceof ApiError && (product.error.status === 404 || product.error.status === 422);
    return missing ? <NotFound /> : <ErrorState error={product.error} onRetry={product.refetch} />;
  }

  return (
    <ProductForm
      key={`${product.data.id}:${version}`}
      product={product.data}
      onSaved={() => {
        product.refetch();
        setVersion((v) => v + 1);
      }}
      onImagesChange={product.refetch}
    />
  );
}

function FormSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading product">
      <Skeleton className="mb-2 h-4 w-20" />
      <Skeleton className="mb-6 h-8 w-72" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="flex flex-col items-start gap-3 p-8">
        <WarningCircle size={28} className="text-subtle" />
        <h1 className="text-xl font-semibold text-ink">Product not found</h1>
        <p className="text-[14px] text-subtle">It may have been deleted, or the link is wrong.</p>
        <Button asChild variant="outline">
          <Link href="/admin/products">Back to products</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

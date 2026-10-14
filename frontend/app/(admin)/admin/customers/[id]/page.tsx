import type { Metadata } from "next";
import { Suspense } from "react";
import { CustomerDetail } from "@/components/admin/customers/CustomerDetail";

export const metadata: Metadata = { title: "Customer" };

export default function CustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  return (
    <Suspense>
      <CustomerDetail params={params} />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderDetail } from "@/components/admin/orders/OrderDetail";

export const metadata: Metadata = { title: "Order" };

export default function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  return (
    <Suspense>
      <OrderDetail params={params} />
    </Suspense>
  );
}

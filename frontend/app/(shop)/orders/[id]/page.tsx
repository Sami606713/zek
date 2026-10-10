import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderDetailView } from "@/components/orders/OrderDetailView";

export const metadata: Metadata = {
  title: "Order details | ZEK",
  robots: { index: false },
};

// Orders live in the browser for now, so the id is resolved on the client.
export default function OrderDetailPage({ params }: PageProps<"/orders/[id]">) {
  return (
    <Suspense>
      <OrderDetailView params={params} />
    </Suspense>
  );
}

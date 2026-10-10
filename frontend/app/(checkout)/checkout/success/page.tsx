import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfirmationSkeleton, OrderConfirmation } from "@/components/checkout/OrderConfirmation";

export const metadata: Metadata = {
  title: "Order confirmed | ZEK",
  robots: { index: false },
};

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<ConfirmationSkeleton />}>
      <OrderConfirmation />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { OrdersView } from "@/components/orders/OrdersView";

export const metadata: Metadata = {
  title: "Orders | ZEK",
  robots: { index: false },
};

export default function OrdersPage() {
  return <OrdersView />;
}

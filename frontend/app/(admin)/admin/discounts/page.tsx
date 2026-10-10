import type { Metadata } from "next";
import { DiscountsManager } from "@/components/admin/discounts/DiscountsManager";

export const metadata: Metadata = { title: "Discounts" };

export default function DiscountsPage() {
  return <DiscountsManager />;
}

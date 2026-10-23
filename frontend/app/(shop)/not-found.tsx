import type { Metadata } from "next";
import { NotFoundView } from "@/components/layout/NotFoundView";

export const metadata: Metadata = { title: "Page not found | ZEK" };

// Shown inside the shop (navbar, footer, chat) when a product or collection doesn't exist.
export default function ShopNotFound() {
  return <NotFoundView />;
}

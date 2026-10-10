import type { Metadata } from "next";
import { WishlistView } from "@/components/wishlist/WishlistView";

export const metadata: Metadata = {
  title: "Wishlist | ZEK",
  robots: { index: false },
};

export default function WishlistPage() {
  return <WishlistView />;
}

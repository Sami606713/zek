import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { CartHydrator } from "@/store/CartHydrator";
import { SecureBadge } from "@/components/checkout/SecureBadge";

// Checkout drops the full navbar and footer so nothing pulls focus from paying.
export default function CheckoutLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <CartHydrator />
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 md:h-[72px] md:px-8">
          <Logo />
          <SecureBadge />
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-[13px] text-subtle md:px-8">
          <p>&copy; 2026 ZEK</p>
          <div className="flex gap-5">
            <Link href="/help/returns" className="hover:text-ink">Returns</Link>
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
          </div>
        </div>
      </footer>
    </>
  );
}

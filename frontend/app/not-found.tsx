import type { Metadata } from "next";
import { Logo } from "@/components/layout/Logo";
import { NotFoundView } from "@/components/layout/NotFoundView";

export const metadata: Metadata = { title: "Page not found | ZEK" };

// Addresses that match no page at all.
export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="px-4 py-6 md:px-8">
        <Logo />
      </header>
      <main className="flex-1">
        <NotFoundView />
      </main>
    </div>
  );
}

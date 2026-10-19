import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CartHydrator } from "@/store/CartHydrator";
import { AgentPanel } from "@/components/agent/AgentPanel";
import { Toaster } from "@/components/ui/sonner";

export default function ShopLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <CartHydrator />
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <AgentPanel />
      <Toaster position="bottom-center" />
    </>
  );
}

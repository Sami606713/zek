import Image from "next/image";
import { Logo } from "@/components/layout/Logo";
import { CartHydrator } from "@/store/CartHydrator";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-[100dvh] flex-1 grid-cols-1 lg:grid-cols-2">
      <CartHydrator />
      <div className="flex flex-col px-4 py-6 md:px-10">
        <Logo />
        <main className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12">{children}</main>
        <p className="text-[13px] text-subtle">&copy; 2026 ZEK</p>
      </div>
      <div className="relative hidden overflow-hidden bg-surface-2 lg:m-3 lg:block lg:rounded-panel">
        <Image src="https://picsum.photos/id/26/1400/1800" alt="" fill priority sizes="50vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0e0f12]/80 via-[#0e0f12]/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-10">
          <p className="max-w-[20ch] text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-[#f4f5f7]">
            Describe it. ZEK finds it.
          </p>
          <p className="mt-3 max-w-[40ch] text-[15px] text-[#f4f5f7]/80">
            One account for the store, the chat assistant and WhatsApp. Your bag and orders follow you everywhere.
          </p>
        </div>
      </div>
    </div>
  );
}

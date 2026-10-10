import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: { default: "Admin | ZEK", template: "%s | ZEK Admin" },
  robots: { index: false, follow: false },
};

// Static admin: no auth guard yet. proxy.ts role check arrives with real JWT (Plan 6, Phase 7).
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <AdminShell>{children}</AdminShell>;
}

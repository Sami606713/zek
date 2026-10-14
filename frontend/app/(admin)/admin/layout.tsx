import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminGuard, CheckingAccess } from "@/components/admin/AdminGuard";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: { default: "Admin | ZEK", template: "%s | ZEK Admin" },
  robots: { index: false, follow: false },
};

// Admins only: AdminGuard checks the role with the backend before anything renders.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    // The guard reads the URL (for ?next= after login), which needs a Suspense boundary.
    <Suspense fallback={<CheckingAccess />}>
      <AdminGuard>
        <AdminShell>{children}</AdminShell>
      </AdminGuard>
    </Suspense>
  );
}

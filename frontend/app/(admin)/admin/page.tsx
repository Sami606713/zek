import type { Metadata } from "next";
import { Dashboard } from "@/components/admin/dashboard/Dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function AdminDashboardPage() {
  return <Dashboard />;
}

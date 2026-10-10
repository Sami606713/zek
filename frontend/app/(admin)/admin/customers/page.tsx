import type { Metadata } from "next";
import { CustomersTable } from "@/components/admin/customers/CustomersTable";

export const metadata: Metadata = { title: "Customers" };

export default function CustomersPage() {
  return <CustomersTable />;
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { InventoryTable } from "@/components/admin/inventory/InventoryTable";

export const metadata: Metadata = { title: "Inventory" };

export default function InventoryPage() {
  return (
    <Suspense>
      <InventoryTable />
    </Suspense>
  );
}

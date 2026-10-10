import type { Metadata } from "next";
import Link from "next/link";
import { customers, getCustomer } from "@/lib/admin/mock";
import { CustomerDetail } from "@/components/admin/customers/CustomerDetail";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Customer" };

export function generateStaticParams() {
  return customers.map((c) => ({ id: c.id }));
}

export default async function CustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  const { id } = await params;
  const customer = getCustomer(id);
  if (!customer) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-start gap-3 rounded-xl border border-line bg-surface p-8">
        <h1 className="text-xl font-semibold text-ink">Customer not found</h1>
        <Button asChild variant="outline">
          <Link href="/admin/customers">Back to customers</Link>
        </Button>
      </div>
    );
  }
  return <CustomerDetail customer={customer} />;
}

import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "@/components/layout/InfoPage";
import { EXPRESS_SHIPPING, FLAT_SHIPPING, FREE_SHIPPING_THRESHOLD, TAX_RATE, deliveryOptions } from "@/lib/pricing";

export const metadata: Metadata = { title: "Shipping | ZEK" };

const usd = (n: number) => `$${n.toFixed(2)}`;
const eta = (value: string) => deliveryOptions.find((d) => d.value === value)?.eta ?? "";

export default function ShippingPage() {
  return (
    <InfoPage
      title="Shipping"
      crumbs={[{ href: "/help", label: "Help" }]}
      intro={<p>Orders are packed within 1 to 2 business days. You choose how fast it travels at checkout.</p>}
      sections={[
        {
          title: "Delivery options",
          body: (
            <div className="overflow-hidden rounded-[12px] border border-line">
              <table className="w-full text-left text-[15px]">
                <thead className="bg-surface-2 text-[13px] text-subtle">
                  <tr>
                    <th className="px-4 py-3 font-medium">Option</th>
                    <th className="px-4 py-3 font-medium">Arrives in</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                  </tr>
                </thead>
                <tbody className="text-ink">
                  <tr className="border-t border-line">
                    <td className="px-4 py-3">Standard</td>
                    <td className="px-4 py-3">{eta("standard")}</td>
                    <td className="px-4 py-3">{usd(FLAT_SHIPPING)}, free over {usd(FREE_SHIPPING_THRESHOLD)}</td>
                  </tr>
                  <tr className="border-t border-line">
                    <td className="px-4 py-3">Express</td>
                    <td className="px-4 py-3">{eta("express")}</td>
                    <td className="px-4 py-3">{usd(EXPRESS_SHIPPING)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ),
        },
        {
          title: "Tracking your parcel",
          body: (
            <p>
              Your order page shows each step: confirmed, packed, shipped and delivered. Once it ships, you&apos;ll see the carrier
              and tracking number there. <Link href="/orders">Go to your orders</Link>.
            </p>
          ),
        },
        {
          title: "Taxes",
          body: (
            <p>
              Checkout shows an estimated tax of {Math.round(TAX_RATE * 100)}% on your order before you pay, so the total you
              see is the total you&apos;re charged.
            </p>
          ),
        },
        {
          title: "Cash on delivery",
          body: <p>Pay the courier when your parcel arrives. Your order is marked as paid once it&apos;s delivered.</p>,
        },
      ]}
    />
  );
}

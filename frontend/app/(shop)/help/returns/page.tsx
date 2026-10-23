import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "@/components/layout/InfoPage";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Returns and refunds | ZEK" };

export default function ReturnsPage() {
  return (
    <InfoPage
      title="Returns and refunds"
      crumbs={[{ href: "/help", label: "Help" }]}
      intro={<p>Not right? Cancel before it&apos;s packed, or return it within 30 days of delivery for a full refund.</p>}
      sections={[
        {
          title: "Cancel an order",
          body: (
            <p>
              Until your order is packed, open it from <Link href="/orders">your orders</Link> and choose{" "}
              <strong>Cancel order</strong>. The items go back into stock and a card payment is refunded in full.
            </p>
          ),
        },
        {
          title: "Return an item",
          body: (
            <>
              <p>You can return items within 30 days of delivery, unused and in their original packaging.</p>
              <p>
                To start a return, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with your order number and the
                items you&apos;re sending back. We&apos;ll reply with how to send them.
              </p>
            </>
          ),
        },
        {
          title: "Refunds",
          body: (
            <ul>
              <li>Card payments are refunded to the same card, usually within 5 to 10 business days after we receive the return.</li>
              <li>Cash on delivery orders are refunded to you directly; we&apos;ll arrange it when you start the return.</li>
              <li>Refunds show on your order page once they&apos;re issued.</li>
            </ul>
          ),
        },
      ]}
    />
  );
}

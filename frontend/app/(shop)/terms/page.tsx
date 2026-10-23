import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "@/components/layout/InfoPage";
import { POLICIES_UPDATED, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Terms | ZEK" };

export default function TermsPage() {
  return (
    <InfoPage
      title="Terms of use"
      updated={POLICIES_UPDATED}
      intro={<p>The rules for using ZEK and buying from the store.</p>}
      sections={[
        {
          title: "Your account",
          body: <p>Keep your password private. You&apos;re responsible for what&apos;s done with your account. Tell us right away if you think someone else has used it.</p>,
        },
        {
          title: "Orders and prices",
          body: (
            <ul>
              <li>Prices are in US dollars. Checkout shows the full total, including shipping and estimated tax, before you pay.</li>
              <li>An order is confirmed when you get an order number (it starts with ZEK-).</li>
              <li>If an item turns out to be unavailable, we&apos;ll cancel that part of the order and refund it.</li>
            </ul>
          ),
        },
        {
          title: "The AI assistant",
          body: (
            <p>
              ZEK&apos;s assistant helps you find products and answers about your orders. It can make mistakes, so check the product
              details, price and total before you buy. It only places an order or makes a change to your account after you&apos;ve
              confirmed it in the chat.
            </p>
          ),
        },
        {
          title: "Cancellations and returns",
          body: (
            <p>
              See <Link href="/help/returns">returns and refunds</Link>: cancel before an order is packed, or return within 30 days
              of delivery.
            </p>
          ),
        },
        {
          title: "Contact",
          body: (
            <p>
              Questions about these terms: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
            </p>
          ),
        },
      ]}
    />
  );
}

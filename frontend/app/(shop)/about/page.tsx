import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "@/components/layout/InfoPage";

export const metadata: Metadata = { title: "About | ZEK" };

export default function AboutPage() {
  return (
    <InfoPage
      title="About ZEK"
      intro={
        <p>
          ZEK is an online store built around an AI shopping assistant. Instead of searching and filtering, you say what you
          need, and ZEK finds it, compares it and helps you buy it.
        </p>
      }
      sections={[
        {
          title: "Shopping by asking",
          body: (
            <p>
              Tell ZEK something like &ldquo;a gift under $50 for a coffee lover&rdquo;. It searches the whole store, sticks to your
              budget and shows products you can add to your bag right in the chat. When you&apos;re signed in, it can also check
              your bag and your orders.
            </p>
          ),
        },
        {
          title: "Honest by design",
          body: (
            <p>
              ZEK only tells you what&apos;s really in the store. If something isn&apos;t stocked, it says so and suggests the closest
              thing we have.
            </p>
          ),
        },
        {
          title: "Built in public",
          body: (
            <p>
              We&apos;re building ZEK step by step and sharing the progress as we go. Start with the{" "}
              <Link href="/products">shop</Link>, or open <strong>Ask ZEK</strong> and try it.
            </p>
          ),
        },
      ]}
    />
  );
}

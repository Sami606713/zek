import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUUpLeft, ChatCircleText, Package, Truck, UserCircle } from "@phosphor-icons/react/ssr";
import { InfoPage } from "@/components/layout/InfoPage";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Help center | ZEK" };

const topics = [
  { href: "/orders", icon: Package, title: "Track an order", text: "Status, tracking number and delivery dates for every order." },
  { href: "/help/shipping", icon: Truck, title: "Shipping", text: "Delivery options, times and when shipping is free." },
  { href: "/help/returns", icon: ArrowUUpLeft, title: "Returns and refunds", text: "Cancel before packing, or return within 30 days." },
  { href: "/account", icon: UserCircle, title: "Your account", text: "Profile, saved addresses, password and preferences." },
];

export default function HelpPage() {
  return (
    <InfoPage
      title="Help center"
      intro={
        <p>
          The fastest way to get help is to ask ZEK in the chat: it can find products, check your bag and look up your orders.
          Answers to the common questions are below.
        </p>
      }
      sections={[
        {
          title: "Questions people ask",
          body: (
            <>
              <p>
                <strong>Where is my order?</strong> Open <Link href="/orders">your orders</Link>. Each order shows its status,
                and once it ships, the carrier and tracking number.
              </p>
              <p>
                <strong>Can I change or cancel an order?</strong> You can cancel it yourself from the order page until it&apos;s
                packed. After that it can&apos;t be changed, but you can <Link href="/help/returns">return it</Link>.
              </p>
              <p>
                <strong>Which payment methods do you take?</strong> Card, or cash on delivery.
              </p>
              <p>
                <strong>I forgot my password.</strong> <Link href="/forgot-password">Reset it here</Link>. The link we send works
                for 15 minutes.
              </p>
            </>
          ),
        },
        {
          title: "Still need help?",
          body: (
            <p>
              Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with your order number (it starts with ZEK-) and
              we&apos;ll get back to you.
            </p>
          ),
        },
      ]}
    >
      <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {topics.map(({ href, icon: Icon, title, text }) => (
          <li key={href}>
            <Link href={href} className="group flex h-full flex-col gap-3 rounded-panel border border-line bg-surface p-5 transition hover:border-ink/30">
              <span className="grid size-10 place-items-center rounded-full bg-brand-soft text-brand">
                <Icon size={20} weight="duotone" />
              </span>
              <span className="flex items-center gap-1.5 text-[16px] font-medium text-ink">
                {title} <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </span>
              <span className="text-[14px] text-subtle">{text}</span>
            </Link>
          </li>
        ))}
        <li className="sm:col-span-2">
          <div className="flex items-center gap-3 rounded-panel bg-surface-2 p-5 text-[14px] text-subtle">
            <ChatCircleText size={20} className="shrink-0 text-brand" weight="duotone" />
            Tip: open <span className="font-medium text-ink">Ask ZEK</span> (top right) and type &ldquo;where is my last order?&rdquo;
          </div>
        </li>
      </ul>
    </InfoPage>
  );
}

import {
  ChatCircleText,
  Globe,
  Microphone,
  WhatsappLogo,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import {
  channelLabels,
  type Channel,
  type FulfilmentStatus,
  type Outcome,
  type PaymentStatus,
  type ProductStatus,
} from "@/lib/admin/mock";
import type { OrderStatus as ApiOrderStatus, PaymentStatus as ApiPaymentStatus } from "@/lib/api/admin";

const tones = {
  brand: "border-transparent bg-brand-soft text-brand",
  solid: "border-transparent bg-ink text-bg",
  neutral: "border-transparent bg-surface-2 text-subtle",
  outline: "border-line bg-transparent text-ink",
  danger: "border-transparent bg-danger/10 text-danger",
} as const;

function Tone({ tone, children }: { tone: keyof typeof tones; children: React.ReactNode }) {
  return <Badge className={`rounded-full font-medium ${tones[tone]}`}>{children}</Badge>;
}

// Mock statuses are a subset of the API's, so both work here.
type OrderStatusValue = FulfilmentStatus | ApiOrderStatus;
type PaymentStatusValue = PaymentStatus | ApiPaymentStatus;

export const orderStatusLabel: Record<OrderStatusValue, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

export function FulfilmentBadge({ status }: { status: OrderStatusValue }) {
  const tone =
    status === "delivered"
      ? "solid"
      : status === "cancelled" || status === "returned"
        ? "neutral"
        : status === "shipped"
          ? "outline"
          : "brand";
  return <Tone tone={tone}>{orderStatusLabel[status]}</Tone>;
}

const paymentMap: Record<PaymentStatusValue, readonly [string, keyof typeof tones]> = {
  paid: ["Paid", "outline"],
  pending: ["Pending", "brand"],
  failed: ["Failed", "danger"],
  partially_refunded: ["Part refunded", "neutral"],
  refunded: ["Refunded", "neutral"],
};

export function PaymentBadge({ status }: { status: PaymentStatusValue }) {
  const [label, tone] = paymentMap[status];
  return <Tone tone={tone}>{label}</Tone>;
}

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const map = { active: ["Active", "outline"], draft: ["Draft", "brand"], archived: ["Archived", "neutral"] } as const;
  const [label, tone] = map[status];
  return <Tone tone={tone}>{label}</Tone>;
}

export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  const map = { purchase: ["Purchase", "solid"], answered: ["Answered", "outline"], unresolved: ["Unresolved", "danger"] } as const;
  const [label, tone] = map[outcome];
  return <Tone tone={tone}>{label}</Tone>;
}

const channelIcons = { web: Globe, agent: ChatCircleText, whatsapp: WhatsappLogo, voice: Microphone };

export function ChannelLabel({ channel }: { channel: Channel }) {
  const Icon = channelIcons[channel];
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-ink">
      <Icon size={15} className="text-subtle" />
      {channelLabels[channel]}
    </span>
  );
}

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

const fulfilmentLabel: Record<FulfilmentStatus, string> = {
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function FulfilmentBadge({ status }: { status: FulfilmentStatus }) {
  const tone =
    status === "delivered" ? "solid" : status === "cancelled" ? "neutral" : status === "shipped" ? "outline" : "brand";
  return <Tone tone={tone}>{fulfilmentLabel[status]}</Tone>;
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const map = { paid: ["Paid", "outline"], pending: ["Pending", "brand"], refunded: ["Refunded", "neutral"] } as const;
  const [label, tone] = map[status];
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

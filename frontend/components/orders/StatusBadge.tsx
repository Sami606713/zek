import {
  CheckCircle,
  MapPin,
  Package,
  Truck,
  XCircle,
} from "@phosphor-icons/react";
import { statusLabels, type OrderStatus } from "@/lib/orderStatus";

const icons = {
  confirmed: CheckCircle,
  packed: Package,
  shipped: Truck,
  delivered: MapPin,
  cancelled: XCircle,
} as const;

export function StatusBadge({ status }: { status: OrderStatus }) {
  const Icon = icons[status];
  const tone =
    status === "cancelled"
      ? "bg-surface-2 text-subtle"
      : status === "delivered"
        ? "bg-ink text-bg"
        : "bg-brand-soft text-brand";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium ${tone}`}>
      <Icon size={14} weight="fill" />
      {statusLabels[status]}
    </span>
  );
}

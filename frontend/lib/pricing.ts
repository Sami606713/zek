import type { CartLine } from "@/store/cartStore";

export const FREE_SHIPPING_THRESHOLD = 50;
export const FLAT_SHIPPING = 5.99;
export const EXPRESS_SHIPPING = 14.99;
export const TAX_RATE = 0.08;

export const deliveryOptions = [
  { value: "standard", label: "Standard", eta: "3 to 5 business days" },
  { value: "express", label: "Express", eta: "1 to 2 business days" },
] as const;

export type Delivery = (typeof deliveryOptions)[number]["value"];

export type ResolvedLine = Omit<CartLine, "product"> & {
  product: NonNullable<CartLine["product"]>;
  lineTotal: number;
};

export const promoCodes: Record<string, { discount: number; type: "percentage" | "fixed" }> = {
  ZEK10: { discount: 10, type: "percentage" },
};

export function resolveLines(lines: CartLine[]): ResolvedLine[] {
  return lines.flatMap((line) => {
    const { product, ...rest } = line;
    if (!product) return [];
    return [{ ...rest, product, lineTotal: product.price * line.quantity }];
  });
}

export function computeTotals(
  lines: ResolvedLine[],
  promo: string | null,
  delivery: Delivery = "standard",
) {
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const savings = 0;
  
  let discount = 0;
  if (promo && promoCodes[promo]) {
    const promoData = promoCodes[promo];
    if (promoData.type === "percentage") {
      discount = round(subtotal * (promoData.discount / 100));
    } else {
      discount = promoData.discount;
    }
  }
  
  const discountedSubtotal = subtotal - discount;
  const standard = lines.length === 0 || discountedSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
  const shipping = delivery === "express" && lines.length > 0 ? EXPRESS_SHIPPING : standard;
  const tax = round(discountedSubtotal * TAX_RATE);
  const total = round(discountedSubtotal + shipping + tax);
  const remainingForFree = Math.max(0, FREE_SHIPPING_THRESHOLD - discountedSubtotal);

  return { subtotal, savings, discount, shipping, tax, total, remainingForFree };
}

const round = (n: number) => Math.round(n * 100) / 100;

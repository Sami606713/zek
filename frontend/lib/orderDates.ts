import type { Delivery } from "./pricing";

const windows: Record<Delivery, [number, number]> = {
  standard: [3, 5],
  express: [1, 2],
};

export function addBusinessDays(start: Date, days: number) {
  const date = new Date(start);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return date;
}

export function estimateDelivery(createdAt: string, delivery: Delivery) {
  const placed = new Date(createdAt);
  const [min, max] = windows[delivery];
  return { from: addBusinessDays(placed, min), to: addBusinessDays(placed, max) };
}

const short = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
const long = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" });

export const formatShortDate = (d: Date) => short.format(d);
export const formatLongDate = (d: Date) => long.format(d);

export const formatRange = ({ from, to }: { from: Date; to: Date }) =>
  `${formatShortDate(from)} to ${formatShortDate(to)}`;

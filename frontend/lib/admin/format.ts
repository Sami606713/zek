import { TODAY } from "./mock";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const moneyCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});
const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });

export const formatMoney = (n: number) => money.format(n);
export const formatMoneyCompact = (n: number) => moneyCompact.format(n);
export const formatDate = (iso: string | Date) => dateFmt.format(new Date(iso));
export const formatShort = (iso: string | Date) => shortDate.format(new Date(iso));
export const formatDateTime = (iso: string | Date) => dateTimeFmt.format(new Date(iso));
export const formatTime = (iso: string | Date) => timeFmt.format(new Date(iso));
export const formatPercent = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`;

// Relative to the mock "today" so it never drifts from the data.
export function formatRelative(iso: string) {
  const diff = TODAY.getTime() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return formatDate(iso);
}

export const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

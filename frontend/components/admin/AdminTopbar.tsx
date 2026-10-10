"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, CaretRight, MagnifyingGlass, Package, Robot, Warning } from "@phosphor-icons/react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { adminOrders, adminProducts, conversations } from "@/lib/admin/mock";

const labels: Record<string, string> = {
  admin: "Dashboard",
  orders: "Orders",
  products: "Products",
  inventory: "Inventory",
  collections: "Collections",
  customers: "Customers",
  discounts: "Discounts",
  agent: "Agent insights",
  conversations: "Conversations",
  settings: "Settings",
  new: "New product",
};

const toPack = adminOrders.filter((o) => o.status === "confirmed").length;
const lowest = adminProducts
  .filter((p) => p.status === "active" && p.stock > 0)
  .sort((a, b) => a.stock - b.stock)[0];
const flagged = conversations.filter((c) => c.flagged).length;

const notifications = [
  { icon: Package, text: `${toPack} orders are waiting to be packed`, href: "/admin/orders?status=confirmed", time: "Now" },
  { icon: Warning, text: `${lowest.name} is down to ${lowest.stock} in stock`, href: "/admin/inventory", time: "1 h ago" },
  { icon: Robot, text: `Agent flagged ${flagged} conversations for review`, href: "/admin/agent/conversations?flagged=1", time: "3 h ago" },
];

export function AdminTopbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");

  const parts = pathname.split("/").filter(Boolean);
  const crumbs = parts.map((part, i) => ({
    href: "/" + parts.slice(0, i + 1).join("/"),
    label: labels[part] ?? part,
  }));

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 rounded-t-xl border-b border-line bg-bg/85 px-4 backdrop-blur-xl md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-5!" />
      <nav aria-label="Breadcrumb" className="hidden min-w-0 md:block">
        <ol className="flex items-center gap-1.5 text-[13px] text-subtle">
          {crumbs.map((c, i) => (
            <li key={c.href} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <CaretRight size={11} aria-hidden />}
              {i === crumbs.length - 1 ? (
                <span aria-current="page" className="truncate font-medium text-ink">{c.label}</span>
              ) : (
                <Link href={c.href} className="hover:text-ink">{c.label}</Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (!q.trim()) return;
          const term = q.trim();
          router.push(term.toUpperCase().startsWith("ZEK-") ? `/admin/orders?q=${encodeURIComponent(term)}` : `/admin/products?q=${encodeURIComponent(term)}`);
        }}
        className="ml-auto w-full max-w-xs"
      >
        <label className="relative block">
          <span className="sr-only">Search orders and products</span>
          <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search orders or products"
            className="h-9 rounded-full bg-surface pl-9 text-[13px]"
          />
        </label>
      </form>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative rounded-full" aria-label="Notifications, 3 new">
            <Bell size={18} />
            <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-brand" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {notifications.map(({ icon: Icon, text, href, time }) => (
            <DropdownMenuItem key={text} asChild className="items-start gap-3 py-2.5">
              <Link href={href}>
                <Icon size={18} className="mt-0.5 text-brand" />
                <span className="flex flex-col gap-0.5">
                  <span className="text-[13px] text-ink">{text}</span>
                  <span className="text-[12px] text-subtle">{time}</span>
                </span>
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartLineUp,
  ChatsCircle,
  Gear,
  Package,
  Receipt,
  Robot,
  SignOut,
  SquaresFour,
  Stack,
  Storefront,
  Tag,
  Users,
  Warehouse,
  CaretUpDown,
} from "@phosphor-icons/react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { adminOrders, adminProducts, conversations } from "@/lib/admin/mock";

const toShip = adminOrders.filter((o) => o.status === "confirmed" || o.status === "packed").length;
const lowStock = adminProducts.filter((p) => p.status === "active" && p.stock <= p.lowStockThreshold).length;
const flagged = conversations.filter((c) => c.flagged).length;

const groups = [
  {
    label: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: SquaresFour }],
  },
  {
    label: "Sales",
    items: [
      { href: "/admin/orders", label: "Orders", icon: Receipt, badge: toShip },
      { href: "/admin/customers", label: "Customers", icon: Users },
      { href: "/admin/discounts", label: "Discounts", icon: Tag },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/admin/products", label: "Products", icon: Package },
      { href: "/admin/inventory", label: "Inventory", icon: Warehouse, badge: lowStock },
      { href: "/admin/collections", label: "Collections", icon: Stack },
    ],
  },
  {
    label: "AI agent",
    items: [
      { href: "/admin/agent", label: "Agent insights", icon: ChartLineUp },
      { href: "/admin/agent/conversations", label: "Conversations", icon: ChatsCircle, badge: flagged },
    ],
  },
  {
    label: "Store",
    items: [{ href: "/admin/settings", label: "Settings", icon: Gear }],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : href === "/admin/agent" ? pathname === "/admin/agent" : pathname.startsWith(href);

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/admin">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ink text-[13px] font-bold text-bg">
                  Z
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-[15px] font-semibold tracking-[-0.03em] text-ink">ZEK</span>
                  <span className="text-[12px] text-subtle">Admin</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map(({ href, label, icon: Icon, badge }) => (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton asChild isActive={isActive(href)} tooltip={label}>
                      <Link href={href}>
                        <Icon weight={isActive(href) ? "fill" : "regular"} />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {badge ? <SidebarMenuBadge>{badge}</SidebarMenuBadge> : null}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="View store">
              <Link href="/" target="_blank">
                <Storefront />
                <span>View store</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-brand-soft text-[12px] font-semibold text-brand">SU</AvatarFallback>
                  </Avatar>
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate text-[13px] font-medium text-ink">Sami Ullah</span>
                    <span className="truncate text-[12px] text-subtle">Owner</span>
                  </span>
                  <CaretUpDown className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuLabel>sami@zek.store</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/admin/settings">
                    <Gear /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/agent">
                    <Robot /> Agent insights
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/">
                    <SignOut /> Log out
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

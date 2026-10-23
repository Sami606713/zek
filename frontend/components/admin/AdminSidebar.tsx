"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
import { conversations } from "@/lib/admin/mock";
import { useLowStock, useOrdersToPack } from "@/lib/admin/live";
import { useUserStore } from "@/store/userStore";
import { ZekSymbol, ZekWordmark } from "@/components/brand/ZekLogo";

const flagged = conversations.filter((c) => c.flagged).length;

const buildGroups = (toPack?: number, lowStock?: number) => [
  {
    label: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: SquaresFour }],
  },
  {
    label: "Sales",
    items: [
      { href: "/admin/orders", label: "Orders", icon: Receipt, badge: toPack },
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

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "A";

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const groups = buildGroups(useOrdersToPack(), useLowStock());
  const name = user?.fullName || user?.username || "Admin";
  const signOut = () => {
    useUserStore.getState().signOut();
    router.replace("/login?next=/admin");
  };
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : href === "/admin/agent" ? pathname === "/admin/agent" : pathname.startsWith(href);

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/admin">
                <ZekSymbol className="size-8 shrink-0" />
                <span className="flex flex-col gap-1 leading-tight">
                  <ZekWordmark className="h-3.5 w-auto self-start" title="ZEK" />
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
                    <AvatarFallback className="rounded-lg bg-brand-soft text-[12px] font-semibold text-brand">{initials(name)}</AvatarFallback>
                  </Avatar>
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate text-[13px] font-medium text-ink">{name}</span>
                    <span className="truncate text-[12px] text-subtle">Admin</span>
                  </span>
                  <CaretUpDown className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
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
                <DropdownMenuItem onSelect={signOut}>
                  <SignOut /> Log out
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

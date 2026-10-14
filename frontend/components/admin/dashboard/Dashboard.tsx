"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Label, Pie, PieChart, XAxis, YAxis } from "recharts";
import {
  ArrowRight,
  ChatCircleText,
  CurrencyDollar,
  HourglassMedium,
  ImageSquare,
  Package,
  Receipt,
  ShoppingBag,
  Truck,
  Warning,
} from "@phosphor-icons/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { ChannelLabel, FulfilmentBadge } from "@/components/admin/badges";
import { CardsSkeleton, ErrorState } from "@/components/admin/states";
import { useUserStore } from "@/store/userStore";
import { formatMoney, formatMoneyCompact, formatPercent, formatRelative, formatShort } from "@/lib/admin/format";
import { unoptimized } from "@/lib/admin/images";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { adminOrders, adminStats } from "@/lib/api/admin";

const revenueConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
} satisfies ChartConfig;

const channelConfig = {
  web: { label: "Web shop", color: "var(--chart-4)" },
  agent: { label: "Agent chat", color: "var(--chart-1)" },
  whatsapp: { label: "WhatsApp", color: "var(--chart-2)" },
  voice: { label: "Voice", color: "var(--chart-3)" },
} satisfies ChartConfig;

const categoryColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

type Range = "7" | "30" | "90";

/** Change vs the previous period, or undefined when there's nothing to compare with. */
const change = (now: number, before: number) => (before > 0 ? (now - before) / before : undefined);

function greeting(hour: number) {
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export function Dashboard() {
  const firstName = useUserStore((s) => (s.user?.fullName || s.user?.username || "").split(" ")[0]);
  const [hour] = useState(() => new Date().getHours());
  const router = useRouter();
  const [range, setRange] = useState<Range>("30");
  const [tz] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const days = Number(range) as 7 | 30 | 90;
  const stats = useAdminQuery(`stats:${days}:${tz}`, () => adminStats.dashboard(days, tz));
  const recent = useAdminQuery("recent-orders", () => adminOrders.list({ limit: 8 }));

  const d = stats.data;
  const cur = d?.current;
  const prev = d?.previous;
  const num = (v: string | undefined) => Number(v ?? 0);
  const compareHint = prev && prev.orders === 0 ? `no orders in the ${days} days before` : `vs previous ${days} days`;

  const series = (d?.series ?? []).map((p) => ({
    date: p.date,
    revenue: num(p.revenue),
    web: num(p.web),
    agent: num(p.agent),
    whatsapp: num(p.whatsapp),
    voice: num(p.voice),
  }));
  // Index keys: category names can contain spaces, which don't work as CSS color variables.
  const categories = (d?.categories ?? []).map((c, i) => ({
    key: `c${i}`,
    category: c.category,
    revenue: num(c.revenue),
    fill: categoryColors[i % categoryColors.length],
  }));
  const categoryConfig = Object.fromEntries(categories.map((c) => [c.key, { label: c.category, color: c.fill }])) satisfies ChartConfig;
  const categoryTotal = categories.reduce((sum, c) => sum + c.revenue, 0);

  const att = d?.attention;
  const attention = att
    ? [
        { icon: Package, label: "Orders to pack", count: att.to_pack, href: "/admin/orders?status=confirmed" },
        { icon: Truck, label: "Packed, waiting to ship", count: att.to_ship, href: "/admin/orders?status=packed" },
        { icon: Warning, label: "Variants low or out of stock", count: att.low_stock, href: "/admin/inventory?filter=low" },
        { icon: CurrencyDollar, label: "Cash on delivery not paid yet", count: att.cod_unpaid, href: "/admin/orders?payment=pending" },
        { icon: HourglassMedium, label: "Orders awaiting payment", count: att.awaiting_payment, href: "/admin/orders?status=pending" },
      ]
    : [];

  return (
    <>
      <PageHeader
        title={firstName ? `${greeting(hour)}, ${firstName}` : greeting(hour)}
        description="Here is how ZEK is doing. Revenue is after refunds and leaves out cancelled orders."
        actions={
          <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
            <TabsList>
              <TabsTrigger value="7">7 days</TabsTrigger>
              <TabsTrigger value="30">30 days</TabsTrigger>
              <TabsTrigger value="90">90 days</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {stats.error && !d ? (
        <ErrorState error={stats.error} onRetry={stats.refetch} />
      ) : !cur || !prev ? (
        <CardsSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy={stats.refreshing}>
          <StatCard label="Revenue" value={formatMoney(num(cur.revenue))} change={change(num(cur.revenue), num(prev.revenue))} hint={compareHint} icon={<CurrencyDollar size={18} />} />
          <StatCard label="Orders" value={String(cur.orders)} change={change(cur.orders, prev.orders)} hint={compareHint} icon={<Receipt size={18} />} />
          <StatCard label="Average order" value={formatMoney(num(cur.average_order))} change={change(num(cur.average_order), num(prev.average_order))} hint="per order" icon={<ShoppingBag size={18} />} />
          <StatCard
            label="Sold by the AI agent"
            value={num(cur.revenue) ? formatPercent(num(cur.agent_revenue) / num(cur.revenue), 0) : "0%"}
            hint={`${formatMoney(num(cur.agent_revenue))} via chat, WhatsApp and voice`}
            icon={<ChatCircleText size={18} />}
          />
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Revenue</CardTitle>
            <CardDescription>Per day, last {days} days</CardDescription>
          </CardHeader>
          <CardContent>
            {!d ? (
              <Skeleton className="h-[260px] w-full rounded-lg" />
            ) : (
              <ChartContainer config={revenueConfig} className="aspect-auto h-[260px] w-full">
                <AreaChart data={series} margin={{ left: 4, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} tickFormatter={(d) => formatShort(d)} />
                  <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v) => formatMoneyCompact(v)} />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="line" labelFormatter={(d) => formatShort(String(d))} formatter={(v) => formatMoney(Number(v))} />}
                  />
                  <Area dataKey="revenue" type="monotone" fill="url(#fillRevenue)" stroke="var(--color-revenue)" strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
            <CardDescription>Things to deal with today</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {!att && Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            {attention.map(({ icon: Icon, label, count, href }) => (
              <Link key={label} href={href} className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                  <Icon size={18} />
                </span>
                <span className="flex-1 text-[14px] text-ink">{label}</span>
                <span className={`text-[15px] font-semibold tabular-nums ${count ? "text-ink" : "text-subtle"}`}>{count}</span>
                <ArrowRight size={14} className="text-subtle transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="lg:col-span-2 xl:col-span-1">
          <CardHeader>
            <CardTitle>Revenue by channel</CardTitle>
            <CardDescription>Where orders came from</CardDescription>
          </CardHeader>
          <CardContent>
            {!d ? (
              <Skeleton className="h-[240px] w-full rounded-lg" />
            ) : (
              <ChartContainer config={channelConfig} className="aspect-auto h-[240px] w-full">
                <BarChart data={series} margin={{ left: 0, right: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={(d) => formatShort(d)} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(d) => formatShort(String(d))} formatter={(v, name) => `${channelConfig[name as keyof typeof channelConfig]?.label ?? name}: ${formatMoney(Number(v))}`} hideIndicator={false} />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="web" stackId="a" fill="var(--color-web)" />
                  <Bar dataKey="agent" stackId="a" fill="var(--color-agent)" />
                  <Bar dataKey="whatsapp" stackId="a" fill="var(--color-whatsapp)" />
                  <Bar dataKey="voice" stackId="a" fill="var(--color-voice)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sales by category</CardTitle>
            <CardDescription>Item sales before discounts, last {days} days</CardDescription>
          </CardHeader>
          <CardContent>
            {!d ? (
              <Skeleton className="mx-auto size-[200px] rounded-full" />
            ) : categories.length === 0 ? (
              <p className="py-16 text-center text-[14px] text-subtle">No sales in this period.</p>
            ) : (
              <>
                <ChartContainer config={categoryConfig} className="mx-auto aspect-square h-[200px]">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent hideLabel formatter={(v, name) => `${categoryConfig[name as string]?.label ?? name}: ${formatMoney(Number(v))}`} />} />
                    <Pie data={categories} dataKey="revenue" nameKey="key" innerRadius={58} strokeWidth={3} stroke="var(--card)">
                      <Label
                        content={({ viewBox }) =>
                          viewBox && "cx" in viewBox ? (
                            <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                              <tspan x={viewBox.cx} y={viewBox.cy} className="fill-ink text-lg font-semibold">
                                {formatMoneyCompact(categoryTotal)}
                              </tspan>
                              <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 18} className="fill-subtle text-[11px]">
                                total
                              </tspan>
                            </text>
                          ) : null
                        }
                      />
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                  {categories.map((c) => (
                    <li key={c.key} className="flex items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-sm" style={{ background: c.fill }} />
                      <span className="flex-1 truncate text-ink">{c.category}</span>
                      <span className="tabular-nums text-subtle">{formatPercent(c.revenue / categoryTotal, 0)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top products</CardTitle>
            <CardDescription>Units sold, last {days} days</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!d && Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
            {d?.top_products.length === 0 && <p className="py-10 text-center text-[14px] text-subtle">No sales in this period.</p>}
            {d?.top_products.map((p, i) => {
              const row = (
                <>
                  <span className="w-4 text-[12px] tabular-nums text-subtle">{i + 1}</span>
                  <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-2 text-subtle">
                    {p.image_url ? (
                      <Image src={p.image_url} alt="" fill sizes="40px" className="object-cover" unoptimized={unoptimized(p.image_url)} />
                    ) : (
                      <ImageSquare size={16} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">{p.name}</span>
                    <span className="block text-[12px] text-subtle">{formatMoney(num(p.revenue))}</span>
                  </span>
                  <span className="text-[13px] font-semibold tabular-nums text-ink">{p.units}</span>
                </>
              );
              return p.product_id ? (
                <Link key={p.product_id} href={`/admin/products/${p.product_id}`} className="flex items-center gap-3 rounded-lg transition-opacity hover:opacity-80">
                  {row}
                </Link>
              ) : (
                <div key={`${p.name}-${i}`} className="flex items-center gap-3">
                  {row}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Recent orders</CardTitle>
            <CardDescription>Latest across every channel</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/orders">
              View all <ArrowRight />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6 text-[12px]">Order</TableHead>
                <TableHead className="text-[12px]">Customer</TableHead>
                <TableHead className="hidden text-[12px] md:table-cell">Channel</TableHead>
                <TableHead className="text-[12px]">Status</TableHead>
                <TableHead className="pr-6 text-right text-[12px]">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.loading &&
                Array.from({ length: 4 }, (_, i) => (
                  <TableRow key={i} className="hover:bg-transparent">
                    <TableCell colSpan={5} className="px-6">
                      <Skeleton className="h-8 rounded-md" />
                    </TableCell>
                  </TableRow>
                ))}
              {recent.data?.items.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="h-24 text-center text-[14px] text-subtle">
                    No orders yet.
                  </TableCell>
                </TableRow>
              )}
              {recent.data?.items.map((o) => (
                <TableRow key={o.id} className="cursor-pointer" onClick={() => router.push(`/admin/orders/${o.id}`)}>
                  <TableCell className="pl-6">
                    <span className="block font-mono text-[13px] font-medium text-ink">{o.order_number}</span>
                    <span className="text-[12px] text-subtle">{formatRelative(o.created_at)}</span>
                  </TableCell>
                  <TableCell className="text-[13px]">{o.customer_name || o.email}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <ChannelLabel channel={o.channel} />
                  </TableCell>
                  <TableCell>
                    <FulfilmentBadge status={o.status} />
                  </TableCell>
                  <TableCell className="pr-6 text-right text-[13px] font-medium tabular-nums">{formatMoney(Number(o.total))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

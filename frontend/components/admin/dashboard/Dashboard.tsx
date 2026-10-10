"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Label, Pie, PieChart, XAxis, YAxis } from "recharts";
import {
  ArrowRight,
  ChatsCircle,
  CurrencyDollar,
  Package,
  Percent,
  Receipt,
  ShoppingBag,
  Warning,
} from "@phosphor-icons/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
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
import {
  adminOrders,
  adminProducts,
  conversations,
  dailySeries,
  getCustomer,
  periodStats,
  salesByCategory,
} from "@/lib/admin/mock";
import { formatMoney, formatMoneyCompact, formatPercent, formatRelative, formatShort } from "@/lib/admin/format";

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

export function Dashboard() {
  const router = useRouter();
  const [range, setRange] = useState<"7" | "30">("30");
  const days = Number(range);
  const stats = periodStats(days);
  const series = dailySeries(days);
  const categories = salesByCategory(days).map((c, i) => ({ ...c, fill: categoryColors[i % categoryColors.length] }));
  const categoryConfig = Object.fromEntries(
    categories.map((c) => [c.category, { label: c.category[0].toUpperCase() + c.category.slice(1), color: c.fill }]),
  ) satisfies ChartConfig;
  const categoryTotal = categories.reduce((s, c) => s + c.revenue, 0);

  const toShip = adminOrders.filter((o) => o.status === "confirmed" || o.status === "packed");
  const pendingCod = adminOrders.filter((o) => o.payment.status === "pending" && o.status !== "cancelled");
  const low = adminProducts.filter((p) => p.status === "active" && p.stock <= p.lowStockThreshold);
  const flagged = conversations.filter((c) => c.flagged);

  const topProducts = [...adminProducts].sort((a, b) => b.sold30d - a.sold30d).slice(0, 5);
  const recent = adminOrders.slice(0, 8);

  const attention = [
    { icon: Package, label: "Orders to pack and ship", count: toShip.length, href: "/admin/orders?status=confirmed" },
    { icon: Warning, label: "Products low or out of stock", count: low.length, href: "/admin/inventory?filter=low" },
    { icon: ChatsCircle, label: "Agent chats flagged for review", count: flagged.length, href: "/admin/agent/conversations?flagged=1" },
    { icon: CurrencyDollar, label: "Cash on delivery awaiting payment", count: pendingCod.length, href: "/admin/orders?payment=pending" },
  ];

  return (
    <>
      <PageHeader
        title="Good afternoon, Sami"
        description="Here is how ZEK is doing. Figures update every few minutes."
        actions={
          <Tabs value={range} onValueChange={(v) => setRange(v as "7" | "30")}>
            <TabsList>
              <TabsTrigger value="7">Last 7 days</TabsTrigger>
              <TabsTrigger value="30">Last 30 days</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" value={formatMoney(stats.revenue)} change={stats.revenueChange} hint={`vs previous ${days} days`} icon={<CurrencyDollar size={18} />} />
        <StatCard label="Orders" value={String(stats.orders)} change={stats.ordersChange} hint={`vs previous ${days} days`} icon={<Receipt size={18} />} />
        <StatCard label="Average order" value={formatMoney(stats.aov)} change={stats.aovChange} hint="per order" icon={<ShoppingBag size={18} />} />
        <StatCard label="Conversion rate" value={formatPercent(stats.conversion)} change={stats.conversionChange} hint="visits to orders" icon={<Percent size={18} />} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Revenue</CardTitle>
            <CardDescription>Daily revenue, excluding cancelled orders</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
            <CardDescription>Things to deal with today</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {attention.map(({ icon: Icon, label, count, href }) => (
              <Link key={label} href={href} className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                  <Icon size={18} />
                </span>
                <span className="flex-1 text-[14px] text-ink">{label}</span>
                <span className="text-[15px] font-semibold tabular-nums text-ink">{count}</span>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sales by category</CardTitle>
            <CardDescription>Last {days} days</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={categoryConfig} className="mx-auto aspect-square h-[200px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel formatter={(v, name) => `${categoryConfig[name as string]?.label ?? name}: ${formatMoney(Number(v))}`} />} />
                <Pie data={categories} dataKey="revenue" nameKey="category" innerRadius={58} strokeWidth={3} stroke="var(--card)">
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
                <li key={c.category} className="flex items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-sm" style={{ background: c.fill }} />
                  <span className="flex-1 capitalize text-ink">{c.category}</span>
                  <span className="tabular-nums text-subtle">{formatPercent(c.revenue / categoryTotal, 0)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top products</CardTitle>
            <CardDescription>Units sold, last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {topProducts.map((p, i) => (
              <Link key={p.id} href={`/admin/products/${p.id}`} className="flex items-center gap-3 rounded-lg transition-opacity hover:opacity-80">
                <span className="w-4 text-[12px] tabular-nums text-subtle">{i + 1}</span>
                <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                  <Image src={p.image} alt="" fill sizes="40px" className="object-cover" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{p.name}</span>
                  <span className="block text-[12px] text-subtle">{formatMoney(p.price * p.sold30d)}</span>
                </span>
                <span className="text-[13px] font-semibold tabular-nums text-ink">{p.sold30d}</span>
              </Link>
            ))}
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
              {recent.map((o) => (
                <TableRow key={o.id} className="cursor-pointer" onClick={() => router.push(`/admin/orders/${o.id}`)}>
                  <TableCell className="pl-6">
                    <span className="block font-mono text-[13px] font-medium text-ink">{o.id}</span>
                    <span className="text-[12px] text-subtle">{formatRelative(o.createdAt)}</span>
                  </TableCell>
                  <TableCell className="text-[13px]">{getCustomer(o.customerId)?.name}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <ChannelLabel channel={o.channel} />
                  </TableCell>
                  <TableCell>
                    <FulfilmentBadge status={o.status} />
                  </TableCell>
                  <TableCell className="pr-6 text-right text-[13px] font-medium tabular-nums">{formatMoney(o.totals.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

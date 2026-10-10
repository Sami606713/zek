"use client";

import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Label, Pie, PieChart, XAxis } from "recharts";
import { ArrowRight, ChatsCircle, CurrencyDollar, Lightning, Plus, SealCheck, Wrench } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { ChannelLabel, OutcomeBadge } from "@/components/admin/badges";
import {
  agentDailySeries,
  agentStats,
  conversations,
  getCustomer,
  missingSearches,
  topQuestions,
} from "@/lib/admin/mock";
import { formatMoney, formatPercent, formatRelative, formatShort } from "@/lib/admin/format";

const volumeConfig = {
  agent: { label: "Web chat", color: "var(--chart-1)" },
  whatsapp: { label: "WhatsApp", color: "var(--chart-2)" },
  voice: { label: "Voice", color: "var(--chart-3)" },
} satisfies ChartConfig;

const outcomeConfig = {
  purchase: { label: "Purchase", color: "var(--chart-1)" },
  answered: { label: "Answered", color: "var(--chart-3)" },
  unresolved: { label: "Unresolved", color: "var(--chart-4)" },
} satisfies ChartConfig;

export function AgentInsights() {
  const series = agentDailySeries(14);
  const outcomes = (["purchase", "answered", "unresolved"] as const).map((o) => ({
    outcome: o,
    count: conversations.filter((c) => c.outcome === o).length,
    fill: `var(--color-${o})`,
  }));
  const purchaseRate = outcomes[0].count / conversations.length;

  const toolCounts: Record<string, number> = {};
  for (const c of conversations)
    for (const m of c.messages)
      if (m.role === "assistant") for (const t of m.tools ?? []) toolCounts[t.name] = (toolCounts[t.name] ?? 0) + 1;
  const tools = Object.entries(toolCounts).sort((a, b) => b[1] - a[1]);
  const flagged = conversations.filter((c) => c.flagged).slice(0, 5);

  return (
    <>
      <PageHeader
        title="Agent insights"
        description="How the ZEK agent is performing across web chat, WhatsApp and voice."
        actions={
          <Button variant="outline" asChild>
            <Link href="/admin/agent/conversations">
              <ChatsCircle /> All conversations
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Conversations (7d)" value={agentStats.conversations7d.toLocaleString("en-US")} change={agentStats.conversationsChange} hint="vs previous week" icon={<ChatsCircle size={18} />} />
        <StatCard label="Revenue via agent" value={formatMoney(agentStats.agentRevenue)} hint={`${agentStats.ordersViaAgent} orders, 60 days`} icon={<CurrencyDollar size={18} />} />
        <StatCard label="Resolved without staff" value={formatPercent(agentStats.resolutionRate)} hint={`${formatPercent(agentStats.handoffRate)} handed to a person`} icon={<SealCheck size={18} />} />
        <StatCard label="Average reply time" value={`${agentStats.avgResponseSec}s`} hint="first token" icon={<Lightning size={18} />} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Conversations per day</CardTitle>
            <CardDescription>Last 14 days, by channel</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={volumeConfig} className="aspect-auto h-[260px] w-full">
              <BarChart data={series}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(d) => formatShort(d)} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(d) => formatShort(String(d))} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="agent" stackId="a" fill="var(--color-agent)" />
                <Bar dataKey="whatsapp" stackId="a" fill="var(--color-whatsapp)" />
                <Bar dataKey="voice" stackId="a" fill="var(--color-voice)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Outcomes</CardTitle>
            <CardDescription>Sampled conversations</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={outcomeConfig} className="mx-auto aspect-square h-[190px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="outcome" />} />
                <Pie data={outcomes} dataKey="count" nameKey="outcome" innerRadius={56} strokeWidth={3} stroke="var(--card)">
                  <Label
                    content={({ viewBox }) =>
                      viewBox && "cx" in viewBox ? (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={viewBox.cx} y={viewBox.cy} className="fill-ink text-lg font-semibold">
                            {formatPercent(purchaseRate, 0)}
                          </tspan>
                          <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 18} className="fill-subtle text-[11px]">
                            bought
                          </tspan>
                        </text>
                      ) : null
                    }
                  />
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="outcome" />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Top questions</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-3">
              {topQuestions.map((q, i) => (
                <li key={q.question} className="flex items-center gap-3 text-[14px]">
                  <span className="w-4 text-[12px] tabular-nums text-subtle">{i + 1}</span>
                  <span className="flex-1 text-ink">{q.question}</span>
                  <span className="tabular-nums text-subtle">{q.count}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Asked for, not stocked</CardTitle>
            <CardDescription>Searches the agent couldn&rsquo;t match</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {missingSearches.map((m) => (
              <div key={m.query} className="flex items-center gap-3 text-[14px]">
                <span className="flex-1 text-ink">&ldquo;{m.query}&rdquo;</span>
                <span className="tabular-nums text-subtle">{m.count}</span>
              </div>
            ))}
            <Button variant="outline" size="sm" className="mt-1 self-start" asChild>
              <Link href="/admin/products/new">
                <Plus /> Add a product
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tools the agent used</CardTitle>
            <CardDescription>Calls in sampled conversations</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {tools.map(([name, count]) => (
              <div key={name} className="flex items-center gap-3 text-[14px]">
                <Wrench size={15} className="text-subtle" />
                <code className="flex-1 font-mono text-[13px] text-ink">{name}</code>
                <span className="tabular-nums text-subtle">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Flagged for review</CardTitle>
            <CardDescription>Chats the agent couldn&rsquo;t finish on its own</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/agent/conversations?flagged=1">
              View all <ArrowRight />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {flagged.map((c) => (
            <Link key={c.id} href={`/admin/agent/conversations/${c.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-2 py-2.5 hover:bg-surface-2">
              <span className="w-32 truncate text-[14px] font-medium text-ink">{c.customerId ? getCustomer(c.customerId)?.name : "Guest"}</span>
              <ChannelLabel channel={c.channel} />
              <span className="min-w-0 flex-1 truncate text-[14px] text-subtle">{c.summary}</span>
              <OutcomeBadge outcome={c.outcome} />
              <span className="text-[12px] text-subtle">{formatRelative(c.startedAt)}</span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

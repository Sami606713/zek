"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { EnvelopeSimple, Key, LockKey, LockKeyOpen, MapPin, Phone, SealCheck } from "@phosphor-icons/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/admin/StatCard";
import { ChannelLabel, FulfilmentBadge, OutcomeBadge } from "@/components/admin/badges";
import { conversations, customerOrders, customerStats, type AdminCustomer } from "@/lib/admin/mock";
import { formatDate, formatMoney, formatRelative, initials } from "@/lib/admin/format";

export function CustomerDetail({ customer }: { customer: AdminCustomer }) {
  const router = useRouter();
  const [status, setStatus] = useState(customer.status);
  const [verified, setVerified] = useState(customer.verified);
  const orders = customerOrders(customer.id);
  const stats = customerStats(customer.id);
  const chats = conversations.filter((c) => c.customerId === customer.id);

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            <AvatarFallback className="bg-brand-soft text-[16px] font-semibold text-brand">{initials(customer.name)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-[-0.03em] text-ink md:text-[28px]">{customer.name}</h1>
              {status === "locked" && <Badge className="rounded-full border-transparent bg-danger/10 text-danger">Locked</Badge>}
              {verified && <SealCheck size={20} weight="fill" className="text-brand" aria-label="Verified email" />}
            </div>
            <p className="text-[14px] text-subtle">
              {customer.id}, customer since {formatDate(customer.joinedAt)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href={`mailto:${customer.email}`}>
              <EnvelopeSimple /> Email
            </a>
          </Button>
          <Button variant="outline" onClick={() => toast.success("Password reset email sent", { description: customer.email })}>
            <Key /> Reset password
          </Button>
          <Button
            variant={status === "locked" ? "default" : "outline"}
            onClick={() => {
              const next = status === "locked" ? "active" : "locked";
              setStatus(next);
              toast.success(next === "locked" ? "Account locked" : "Account unlocked");
            }}
          >
            {status === "locked" ? <LockKeyOpen /> : <LockKey />}
            {status === "locked" ? "Unlock account" : "Lock account"}
          </Button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Orders" value={String(stats.orders)} />
        <StatCard label="Total spent" value={formatMoney(stats.spent)} />
        <StatCard label="Average order" value={formatMoney(stats.aov)} />
        <StatCard label="Last order" value={stats.lastOrder ? formatRelative(stats.lastOrder) : "Never"} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Orders</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {orders.length === 0 ? (
                <p className="px-6 text-[14px] text-subtle">No orders yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-6 text-[12px]">Order</TableHead>
                      <TableHead className="text-[12px]">Channel</TableHead>
                      <TableHead className="text-[12px]">Status</TableHead>
                      <TableHead className="pr-6 text-right text-[12px]">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((o) => (
                      <TableRow key={o.id} className="cursor-pointer" onClick={() => router.push(`/admin/orders/${o.id}`)}>
                        <TableCell className="pl-6">
                          <span className="block font-mono text-[13px] font-medium">{o.id}</span>
                          <span className="text-[12px] text-subtle">{formatDate(o.createdAt)}</span>
                        </TableCell>
                        <TableCell><ChannelLabel channel={o.channel} /></TableCell>
                        <TableCell><FulfilmentBadge status={o.status} /></TableCell>
                        <TableCell className="pr-6 text-right text-[13px] font-medium tabular-nums">{formatMoney(o.totals.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Agent conversations</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {chats.length === 0 ? (
                <p className="text-[14px] text-subtle">This customer hasn&rsquo;t chatted with the agent yet.</p>
              ) : (
                chats.map((c) => (
                  <Link key={c.id} href={`/admin/agent/conversations/${c.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
                    <ChannelLabel channel={c.channel} />
                    <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{c.summary}</span>
                    <OutcomeBadge outcome={c.outcome} />
                    <span className="hidden text-[12px] text-subtle sm:inline">{formatRelative(c.startedAt)}</span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-[14px]">
            <p className="flex items-center gap-2.5"><EnvelopeSimple size={16} className="text-subtle" /> {customer.email}</p>
            <p className="flex items-center gap-2.5"><Phone size={16} className="text-subtle" /> {customer.phone}</p>
            <p className="flex items-start gap-2.5"><MapPin size={16} className="mt-0.5 text-subtle" /> {customer.street}<br />{customer.city}, {customer.country}</p>
            <div className="mt-2 flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2.5">
              <span className="text-ink">Email {verified ? "verified" : "not verified"}</span>
              {!verified && (
                <Button size="sm" variant="outline" onClick={() => { setVerified(true); toast.success("Marked as verified"); }}>
                  Verify
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { CaretDown, Flag, HandWaving, PaperPlaneRight, Robot, User, Wrench } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ChannelLabel, OutcomeBadge } from "@/components/admin/badges";
import { getCustomer, type Conversation, type Message, type ToolCall } from "@/lib/admin/mock";
import { formatDateTime, formatTime } from "@/lib/admin/format";

function ToolCallCard({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false);
  const empty = Array.isArray(call.output) && call.output.length === 0;
  return (
    <div className="rounded-lg border border-line bg-bg text-[12px]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <Wrench size={13} className="text-brand" />
        <code className="font-mono font-medium text-ink">{call.name}</code>
        {empty && <span className="rounded-full bg-danger/10 px-1.5 py-0.5 text-[11px] text-danger">no results</span>}
        <CaretDown size={12} className={`ml-auto text-subtle transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="grid gap-2 border-t border-line px-3 py-2.5">
          <div>
            <p className="mb-1 text-[11px] font-medium text-subtle">Input</p>
            <pre className="overflow-x-auto rounded-md bg-surface-2 p-2 font-mono text-[11px] text-ink">{JSON.stringify(call.input, null, 2)}</pre>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-medium text-subtle">Output</p>
            <pre className="overflow-x-auto rounded-md bg-surface-2 p-2 font-mono text-[11px] text-ink">{JSON.stringify(call.output, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function Bubble({ m, customerName }: { m: Message; customerName: string }) {
  if (m.role === "user") {
    return (
      <div className="flex max-w-[80%] gap-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-subtle"><User size={14} /></span>
        <div>
          <p className="mb-1 text-[11px] text-subtle">{customerName}, {formatTime(m.at)}</p>
          <p className="rounded-2xl rounded-tl-md bg-surface-2 px-3.5 py-2.5 text-[14px] text-ink">{m.text}</p>
        </div>
      </div>
    );
  }
  const staff = m.role === "staff";
  return (
    <div className="ml-auto flex max-w-[80%] flex-row-reverse gap-2.5">
      <span className={`grid size-7 shrink-0 place-items-center rounded-full ${staff ? "bg-ink text-bg" : "bg-brand text-brand-ink"}`}>
        {staff ? <HandWaving size={14} /> : <Robot size={14} />}
      </span>
      <div className="flex flex-col items-end gap-1.5">
        <p className="text-[11px] text-subtle">{staff ? "ZEK team" : "Agent"}, {formatTime(m.at)}</p>
        {m.role === "assistant" && m.tools && (
          <div className="flex w-full min-w-[260px] flex-col gap-1.5">
            {m.tools.map((t, i) => <ToolCallCard key={i} call={t} />)}
          </div>
        )}
        <p className={`rounded-2xl rounded-tr-md px-3.5 py-2.5 text-[14px] ${staff ? "bg-ink text-bg" : "bg-brand-soft text-ink"}`}>{m.text}</p>
      </div>
    </div>
  );
}

export function Transcript({ conversation }: { conversation: Conversation }) {
  const customer = conversation.customerId ? getCustomer(conversation.customerId) : undefined;
  const name = customer?.name ?? "Guest";
  const [messages, setMessages] = useState(conversation.messages);
  const [flagged, setFlagged] = useState(conversation.flagged);
  const [takenOver, setTakenOver] = useState(false);
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-ink md:text-[28px]">{name}</h1>
            <OutcomeBadge outcome={conversation.outcome} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-3 text-[14px] text-subtle">
            <span className="font-mono">{conversation.id}</span>
            <ChannelLabel channel={conversation.channel} />
            <span>{formatDateTime(conversation.startedAt)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={flagged ? "default" : "outline"}
            onClick={() => {
              setFlagged(!flagged);
              toast.success(flagged ? "Flag removed" : "Flagged for review");
            }}
          >
            <Flag weight={flagged ? "fill" : "regular"} /> {flagged ? "Flagged" : "Flag"}
          </Button>
          {conversation.channel === "whatsapp" && !takenOver && (
            <Button
              variant="outline"
              onClick={() => {
                setTakenOver(true);
                toast.success("You're now replying on WhatsApp", { description: "The agent is paused for this chat." });
              }}
            >
              <HandWaving /> Take over chat
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Transcript</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {messages.map((m, i) => <Bubble key={i} m={m} customerName={name} />)}
            {takenOver && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!reply.trim()) return;
                  setMessages((prev) => [...prev, { role: "staff", text: reply.trim(), at: new Date().toISOString() }]);
                  setReply("");
                }}
                className="flex gap-2 border-t border-line pt-4"
              >
                <label className="sr-only" htmlFor="staff-reply">Reply as the ZEK team</label>
                <Input id="staff-reply" value={reply} onChange={(e) => setReply(e.target.value)} placeholder={`Reply to ${name} on WhatsApp`} />
                <Button type="submit" disabled={!reply.trim()}>
                  <PaperPlaneRight /> Send
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-2.5 text-[14px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-subtle">Customer</dt>
                  <dd>{customer ? <Link href={`/admin/customers/${customer.id}`} className="text-brand hover:underline">{customer.name}</Link> : "Guest"}</dd>
                </div>
                <div className="flex justify-between gap-4"><dt className="text-subtle">Messages</dt><dd className="tabular-nums">{messages.length}</dd></div>
                <div className="flex justify-between gap-4">
                  <dt className="text-subtle">Tool calls</dt>
                  <dd className="tabular-nums">{messages.reduce((n, m) => n + (m.role === "assistant" ? m.tools?.length ?? 0 : 0), 0)}</dd>
                </div>
                {conversation.orderId && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-subtle">Order</dt>
                    <dd><Link href={`/admin/orders/${conversation.orderId}`} className="font-mono text-brand hover:underline">{conversation.orderId}</Link></dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Review note</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!note.trim()) return;
                  toast.success("Note saved", { description: "Used to improve the agent's answers." });
                  setNote("");
                }}
                className="flex flex-col gap-2"
              >
                <Label htmlFor="review-note">What should the agent have done?</Label>
                <Textarea id="review-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: suggest the Pocket Speaker as an alternative" />
                <Button type="submit" variant="outline" className="self-end" disabled={!note.trim()}>Save note</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

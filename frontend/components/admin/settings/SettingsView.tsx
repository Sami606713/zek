"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle, Plus, Warning, XCircle } from "@phosphor-icons/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/PageHeader";
import { integrations, team as seedTeam } from "@/lib/admin/mock";
import { initials } from "@/lib/admin/format";
import { EXPRESS_SHIPPING, FLAT_SHIPPING, FREE_SHIPPING_THRESHOLD, TAX_RATE } from "@/lib/pricing";

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-[13px] text-subtle">{hint}</p>}
    </div>
  );
}

const saved = (what: string) => toast.success(`${what} saved`, { description: "Demo mode: not sent to the backend yet." });

export function SettingsView() {
  const [team, setTeam] = useState(seedTeam);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);

  return (
    <>
      <PageHeader title="Settings" description="Store details, shipping, your team and connected services." />

      <Tabs defaultValue="store" className="gap-4">
        <TabsList>
          <TabsTrigger value="store">Store</TabsTrigger>
          <TabsTrigger value="shipping">Shipping and tax</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="store">
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle>Store details</CardTitle>
              <CardDescription>Shown on receipts, emails and in agent replies.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="s-name" label="Store name"><Input id="s-name" defaultValue="ZEK" /></Field>
              <Field id="s-email" label="Support email"><Input id="s-email" type="email" defaultValue="help@zek.store" /></Field>
              <Field id="s-currency" label="Currency">
                <Select defaultValue="USD">
                  <SelectTrigger id="s-currency" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">US Dollar (USD)</SelectItem>
                    <SelectItem value="PKR">Pakistani Rupee (PKR)</SelectItem>
                    <SelectItem value="GBP">British Pound (GBP)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field id="s-phone" label="WhatsApp number" hint="Customers continue chats here.">
                <Input id="s-phone" defaultValue="+92 300 1234567" />
              </Field>
              <label className="flex items-center justify-between gap-4 rounded-lg border border-line px-4 py-3 text-[14px] sm:col-span-2">
                <span>
                  <span className="block font-medium text-ink">Let the agent place orders</span>
                  <span className="block text-[13px] text-subtle">When off, the agent builds a bag and sends a checkout link.</span>
                </span>
                <Switch defaultChecked />
              </label>
            </CardContent>
            <CardFooter className="justify-end">
              <Button onClick={() => saved("Store details")}>Save</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="shipping">
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle>Shipping and tax</CardTitle>
              <CardDescription>Used by the cart, checkout and the agent when quoting totals.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="sh-free" label="Free shipping from (USD)"><Input id="sh-free" inputMode="decimal" defaultValue={FREE_SHIPPING_THRESHOLD} /></Field>
              <Field id="sh-flat" label="Standard shipping (USD)" hint="3 to 5 business days"><Input id="sh-flat" inputMode="decimal" defaultValue={FLAT_SHIPPING} /></Field>
              <Field id="sh-exp" label="Express shipping (USD)" hint="1 to 2 business days"><Input id="sh-exp" inputMode="decimal" defaultValue={EXPRESS_SHIPPING} /></Field>
              <Field id="sh-tax" label="Tax rate (%)" hint="Estimate shown before checkout"><Input id="sh-tax" inputMode="decimal" defaultValue={TAX_RATE * 100} /></Field>
              <label className="flex items-center justify-between gap-4 rounded-lg border border-line px-4 py-3 text-[14px] sm:col-span-2">
                <span>
                  <span className="block font-medium text-ink">Cash on delivery</span>
                  <span className="block text-[13px] text-subtle">Offer pay-on-arrival at checkout and on WhatsApp.</span>
                </span>
                <Switch defaultChecked />
              </label>
            </CardContent>
            <CardFooter className="justify-end">
              <Button onClick={() => saved("Shipping and tax")}>Save</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <Card className="max-w-3xl">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Team</CardTitle>
                <CardDescription>People who can open this admin.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setInviteOpen(true)}><Plus /> Invite</Button>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6 text-[12px]">Member</TableHead>
                    <TableHead className="text-[12px]">Role</TableHead>
                    <TableHead className="pr-6 text-right text-[12px]">Last active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {team.map((m) => (
                    <TableRow key={m.email}>
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8"><AvatarFallback className="bg-brand-soft text-[11px] font-semibold text-brand">{initials(m.name)}</AvatarFallback></Avatar>
                          <div>
                            <p className="text-[13px] font-medium text-ink">{m.name}</p>
                            <p className="text-[12px] text-subtle">{m.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="rounded-full">{m.role}</Badge></TableCell>
                      <TableCell className="pr-6 text-right text-[13px] text-subtle">{m.lastActive}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <div className="grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
            {integrations.map((i) => (
              <Card key={i.name} className="py-0">
                <CardContent className="flex items-center gap-3 p-4">
                  {i.status === "connected" ? (
                    <CheckCircle size={22} weight="fill" className="text-brand" />
                  ) : i.status === "attention" ? (
                    <Warning size={22} weight="fill" className="text-danger" />
                  ) : (
                    <XCircle size={22} className="text-subtle" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-ink">{i.name}</p>
                    <p className="text-[13px] text-subtle">
                      {i.detail}, {i.status === "connected" ? "connected" : i.status === "attention" ? "needs attention" : "not connected"}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => toast(`${i.name} settings`, { description: "Configured on the backend in Phase 7." })}>
                    {i.status === "not_connected" ? "Connect" : "Manage"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a team member</DialogTitle>
            <DialogDescription>They get an email with a link to set a password.</DialogDescription>
          </DialogHeader>
          <form
            id="invite-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              const email = inviteEmail.trim().toLowerCase();
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setInviteError("Enter a valid email address.");
              if (team.some((m) => m.email === email)) return setInviteError("That person is already on the team.");
              setTeam((prev) => [...prev, { name: email.split("@")[0], email, role: "Admin", lastActive: "Invited" }]);
              toast.success(`Invite sent to ${email}`);
              setInviteEmail("");
              setInviteError(null);
              setInviteOpen(false);
            }}
            className="flex flex-col gap-2"
          >
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => {
                setInviteEmail(e.target.value);
                setInviteError(null);
              }}
              aria-invalid={Boolean(inviteError)}
              placeholder="name@zek.store"
            />
            {inviteError && <p role="alert" className="text-[13px] text-danger">{inviteError}</p>}
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button type="submit" form="invite-form">Send invite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

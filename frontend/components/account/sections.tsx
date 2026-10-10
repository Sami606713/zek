"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion } from "motion/react";
import { Check, CircleNotch, MapPin, PencilSimple, Plus, Star, Trash } from "@phosphor-icons/react";
import { Field } from "@/components/checkout/Field";
import { PasswordField } from "@/components/auth/PasswordField";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { countries } from "@/lib/checkoutValidation";
import {
  AuthError,
  passwordChangeSchema,
  passwordStrength,
  profileSchema,
  type PasswordChangeInput,
  type ProfileInput,
} from "@/lib/auth";
import { changePassword, deleteAccount, updateProfile } from "@/lib/api/auth";
import { useUserStore, type SessionUser } from "@/store/userStore";
import { useAddressStore, type Address } from "@/store/addressStore";

// ─── Shared bits ─────────────────────────────────────────────────────────────

export function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-panel bg-surface p-6 md:p-8">
      <h2 className="text-xl font-semibold tracking-[-0.02em] text-ink">{title}</h2>
      {description && <p className="mt-1 text-[14px] text-subtle">{description}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function SaveRow({ busy, saved, label = "Save changes", disabled }: { busy: boolean; saved: boolean; label?: string; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-end gap-3 border-t border-line pt-5 sm:col-span-2">
      <AnimatePresence>
        {saved && (
          <motion.span
            role="status"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="inline-flex items-center gap-1.5 text-[14px] text-brand"
          >
            <Check size={16} weight="bold" /> Saved
          </motion.span>
        )}
      </AnimatePresence>
      <button
        type="submit"
        disabled={busy || disabled}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-6 text-[14px] font-medium text-bg transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
      >
        {busy && <CircleNotch size={16} className="animate-spin" />}
        {busy ? "Saving" : label}
      </button>
    </div>
  );
}

const useFlash = () => {
  const [on, setOn] = useState(false);
  return [on, () => { setOn(true); window.setTimeout(() => setOn(false), 2200); }] as const;
};

// ─── Profile ─────────────────────────────────────────────────────────────────

export function ProfileSection({ user }: { user: SessionUser }) {
  const updateUser = useUserStore((s) => s.updateUser);
  const [saved, flash] = useFlash();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: user.fullName, username: user.username, email: user.email, phone: user.phone ?? "" },
  });

  const onSubmit = async (values: ProfileInput) => {
    try {
      const token = user.token;
      if (!token) return;
      const updated = await updateProfile(token, values);
      updateUser({ fullName: updated.fullName, username: updated.username, email: updated.email, phone: updated.phone });
      reset(values);
      flash();
    } catch (e) {
      if (e instanceof AuthError && (e.field === "email" || e.field === "username")) setError(e.field, { message: e.message });
    }
  };

  return (
    <Panel title="Profile" description="How we address you, and where receipts and order updates go.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field id="acc-name" label="Full name" autoComplete="name" error={errors.fullName?.message} {...register("fullName")} />
        <Field id="acc-username" label="Username" autoComplete="username" error={errors.username?.message} {...register("username")} />
        <Field id="acc-email" label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
        <Field id="acc-phone" label="Phone" optional type="tel" autoComplete="tel" hint="Used for WhatsApp order updates." error={errors.phone?.message} {...register("phone")} />
        <SaveRow busy={isSubmitting} saved={saved} disabled={!isDirty} />
      </form>
    </Panel>
  );
}

// ─── Addresses ───────────────────────────────────────────────────────────────

const addressSchema = z.object({
  label: z.string().trim().min(1, "Give it a name, like Home."),
  name: z.string().trim().min(2, "Enter the recipient's name."),
  line1: z.string().trim().min(3, "Enter the street address."),
  line2: z.string().trim(),
  city: z.string().trim().min(2, "Enter the city."),
  region: z.string().trim().min(2, "Enter the state or province."),
  postal: z.string().trim().regex(/^[A-Za-z0-9 -]{3,10}$/, "Enter a valid postal code."),
  country: z.string().min(1),
  phone: z.string().trim().refine((v) => v === "" || /^\+?[0-9 ()-]{7,20}$/.test(v), "Enter a valid phone number."),
});
type AddressInput = z.infer<typeof addressSchema>;

function AddressForm({ initial, fallbackName, onDone }: { initial?: Address; fallbackName: string; onDone: () => void }) {
  const save = useAddressStore((s) => s.save);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AddressInput>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      label: initial?.label ?? "Home",
      name: initial?.name ?? fallbackName,
      line1: initial?.line1 ?? "",
      line2: initial?.line2 ?? "",
      city: initial?.city ?? "",
      region: initial?.region ?? "",
      postal: initial?.postal ?? "",
      country: initial?.country ?? "United States",
      phone: initial?.phone ?? "",
    },
  });

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit((v) => {
        save({ ...v, id: initial?.id, line2: v.line2 || undefined, phone: v.phone || undefined });
        onDone();
      })}
      noValidate
      className="grid grid-cols-1 gap-4 rounded-[16px] border border-line p-5 sm:grid-cols-2"
    >
      <Field id="ad-label" label="Label" placeholder="Home" error={errors.label?.message} {...register("label")} />
      <Field id="ad-name" label="Recipient" autoComplete="name" error={errors.name?.message} {...register("name")} />
      <Field id="ad-line1" label="Address" autoComplete="address-line1" className="sm:col-span-2" error={errors.line1?.message} {...register("line1")} />
      <Field id="ad-line2" label="Apartment, suite, etc." optional autoComplete="address-line2" className="sm:col-span-2" {...register("line2")} />
      <Field id="ad-city" label="City" autoComplete="address-level2" error={errors.city?.message} {...register("city")} />
      <Field id="ad-region" label="State or province" autoComplete="address-level1" error={errors.region?.message} {...register("region")} />
      <Field id="ad-postal" label="Postal code" autoComplete="postal-code" error={errors.postal?.message} {...register("postal")} />
      <div className="flex flex-col gap-2">
        <label htmlFor="ad-country" className="text-[14px] font-medium text-ink">Country</label>
        <select
          id="ad-country"
          autoComplete="country-name"
          {...register("country")}
          className="w-full rounded-[12px] border border-line bg-surface px-4 py-3 text-[15px] text-ink outline-none focus:border-brand focus:ring-4 focus:ring-brand-soft"
        >
          {countries.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <Field id="ad-phone" label="Phone" optional type="tel" className="sm:col-span-2" error={errors.phone?.message} {...register("phone")} />
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" onClick={onDone} className="rounded-full px-5 py-2.5 text-[14px] font-medium text-subtle hover:bg-surface-2 hover:text-ink">
          Cancel
        </button>
        <button type="submit" className="rounded-full bg-ink px-6 py-2.5 text-[14px] font-medium text-bg transition hover:opacity-90 active:scale-[0.98]">
          {initial ? "Save address" : "Add address"}
        </button>
      </div>
    </motion.form>
  );
}

export function AddressesSection({ user }: { user: SessionUser }) {
  const addresses = useAddressStore((s) => s.addresses);
  const defaultId = useAddressStore((s) => s.defaultId);
  const remove = useAddressStore((s) => s.remove);
  const setDefault = useAddressStore((s) => s.setDefault);
  const [editing, setEditing] = useState<string | "new" | null>(null);

  return (
    <Panel title="Addresses" description="Saved addresses for faster checkout. The agent can also ship to these.">
      <div className="flex flex-col gap-3">
        {addresses.length === 0 && editing !== "new" && (
          <div className="flex flex-col items-start gap-3 rounded-[16px] border border-dashed border-line p-6">
            <MapPin size={22} className="text-subtle" />
            <p className="text-[15px] text-ink">No saved addresses yet.</p>
          </div>
        )}

        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <AnimatePresence initial={false}>
            {addresses.map((a) =>
              editing === a.id ? (
                <li key={a.id} className="lg:col-span-2">
                  <AddressForm initial={a} fallbackName={user.fullName} onDone={() => setEditing(null)} />
                </li>
              ) : (
                <motion.li
                  key={a.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className={`flex flex-col gap-3 rounded-[16px] border p-5 ${a.id === defaultId ? "border-brand bg-brand-soft" : "border-line"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[15px] font-semibold text-ink">{a.label}</p>
                    {a.id === defaultId && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-0.5 text-[12px] font-medium text-brand-ink">
                        <Star size={11} weight="fill" /> Default
                      </span>
                    )}
                  </div>
                  <address className="text-[14px] not-italic leading-relaxed text-subtle">
                    {a.name}
                    <br />
                    {a.line1}
                    {a.line2 && <>, {a.line2}</>}
                    <br />
                    {a.city}, {a.region} {a.postal}
                    <br />
                    {a.country}
                    {a.phone && (
                      <>
                        <br />
                        {a.phone}
                      </>
                    )}
                  </address>
                  <div className="mt-auto flex flex-wrap gap-1">
                    <button type="button" onClick={() => setEditing(a.id)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-surface-2">
                      <PencilSimple size={14} /> Edit
                    </button>
                    {a.id !== defaultId && (
                      <button type="button" onClick={() => setDefault(a.id)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-surface-2">
                        <Star size={14} /> Make default
                      </button>
                    )}
                    <button type="button" onClick={() => remove(a.id)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-subtle hover:bg-surface-2 hover:text-ink">
                      <Trash size={14} /> Remove
                    </button>
                  </div>
                </motion.li>
              ),
            )}
          </AnimatePresence>
        </ul>

        {editing === "new" ? (
          <AddressForm fallbackName={user.fullName} onDone={() => setEditing(null)} />
        ) : (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="inline-flex items-center gap-2 self-start rounded-full border border-line px-5 py-2.5 text-[14px] font-medium text-ink transition hover:bg-surface-2"
          >
            <Plus size={16} /> Add address
          </button>
        )}
      </div>
    </Panel>
  );
}

// ─── Security ────────────────────────────────────────────────────────────────

export function SecuritySection({ user }: { user: SessionUser }) {
  const router = useRouter();
  const signOut = useUserStore((s) => s.signOut);
  const [saved, flash] = useFlash();
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordChangeInput>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { current: "", next: "", confirm: "" },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- RHF watch drives the strength meter
  const next = watch("next");
  const strength = passwordStrength(next);

  const onSubmit = async (v: PasswordChangeInput) => {
    try {
      const token = user.token;
      if (!token) return;
      await changePassword(token, v.current, v.next);
      reset();
      flash();
    } catch (e) {
      if (e instanceof AuthError) setError("current", { message: e.message });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Password" description="Use at least 8 characters. A longer phrase is stronger than symbols.">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2 sm:max-w-[calc(50%-10px)]">
            <PasswordField id="pw-current" label="Current password" autoComplete="current-password" error={errors.current?.message} {...register("current")} />
          </div>
          <PasswordField
            id="pw-next"
            label="New password"
            autoComplete="new-password"
            error={errors.next?.message}
            hint={
              <div className="flex items-center gap-3" aria-live="polite">
                <div className="flex flex-1 gap-1" aria-hidden>
                  {[1, 2, 3, 4].map((i) => (
                    <span key={i} className={`h-1 flex-1 rounded-full ${next && strength.score >= i ? "bg-brand" : "bg-line"}`} />
                  ))}
                </div>
                <span className="w-16 text-right text-[13px] text-subtle">{next ? strength.label : "8+ chars"}</span>
              </div>
            }
            {...register("next")}
          />
          <PasswordField id="pw-confirm" label="Repeat new password" autoComplete="new-password" error={errors.confirm?.message} {...register("confirm")} />
          <SaveRow busy={isSubmitting} saved={saved} label="Change password" />
        </form>
      </Panel>

      <Panel title="Sessions">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[14px] text-subtle">You&rsquo;re signed in on this browser as {user.email}.</p>
          <button
            type="button"
            onClick={() => {
              signOut();
              router.push("/");
            }}
            className="self-start rounded-full border border-line px-5 py-2.5 text-[14px] font-medium text-ink transition hover:bg-surface-2"
          >
            Log out
          </button>
        </div>
      </Panel>

      <section className="rounded-panel border border-danger/30 p-6 md:p-8">
        <h2 className="text-xl font-semibold tracking-[-0.02em] text-ink">Delete account</h2>
        <p className="mt-1 max-w-[60ch] text-[14px] text-subtle">
          Removes your profile, saved addresses and chat history. Past orders stay on record for tax and warranty reasons.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button type="button" className="mt-5 rounded-full bg-[#c62f2f] px-5 py-2.5 text-[14px] font-medium text-[#fbfbfc] transition hover:opacity-90">
              Delete my account
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your ZEK account?</AlertDialogTitle>
              <AlertDialogDescription>This can&rsquo;t be undone. You&rsquo;ll be logged out right away.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep my account</AlertDialogCancel>
              <AlertDialogAction
                className="bg-[#c62f2f] text-[#fbfbfc] hover:bg-[#c62f2f]/90"
                onClick={async () => {
                  if (!user.token) return;
                  await deleteAccount(user.token);
                  signOut();
                  router.push("/");
                }}
              >
                Delete account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  );
}

// ─── Preferences ─────────────────────────────────────────────────────────────

const prefItems = [
  { key: "orderEmails", title: "Order updates by email", body: "Confirmations, shipping and delivery." },
  { key: "whatsapp", title: "Order updates on WhatsApp", body: "Needs a phone number on your profile." },
  { key: "newsletter", title: "New drops and price alerts", body: "One email a week, at most." },
] as const;

export function PreferencesSection({ user }: { user: SessionUser }) {
  const updateUser = useUserStore((s) => s.updateUser);
  const prefs = user.prefs ?? { orderEmails: true, whatsapp: false, newsletter: false };

  return (
    <Panel title="Notifications" description="Choose how ZEK keeps in touch. Changes save straight away.">
      <ul className="divide-y divide-line">
        {prefItems.map((item) => {
          const disabled = item.key === "whatsapp" && !user.phone;
          return (
            <li key={item.key} className="flex items-center justify-between gap-6 py-4 first:pt-0 last:pb-0">
              <label htmlFor={`pref-${item.key}`} className="cursor-pointer">
                <span className="block text-[15px] font-medium text-ink">{item.title}</span>
                <span className="block text-[13px] text-subtle">{disabled ? "Add a phone number in Profile to turn this on." : item.body}</span>
              </label>
              <Switch
                id={`pref-${item.key}`}
                checked={prefs[item.key] && !disabled}
                disabled={disabled}
                onCheckedChange={(v) => updateUser({ prefs: { ...prefs, [item.key]: v } })}
              />
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

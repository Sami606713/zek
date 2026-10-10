"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  Bag,
  CaretDown,
  CircleNotch,
  CreditCard,
  LockKey,
  Money,
} from "@phosphor-icons/react";
import { formatPrice } from "@/lib/catalog";
import {
  computeTotals,
  deliveryOptions,
  EXPRESS_SHIPPING,
  resolveLines,
  type Delivery,
} from "@/lib/pricing";
import {
  countries,
  fieldOrder,
  formatCardNumber,
  formatExpiry,
  validateAll,
  validateField,
  type CheckoutErrors,
  type CheckoutValues,
  type PaymentMethod,
} from "@/lib/checkoutValidation";
import { useCartStore } from "@/store/cartStore";
import { useAddressStore, type Address } from "@/store/addressStore";
import { useUserStore } from "@/store/userStore";
import { placeOrder } from "@/lib/api/orders";
import { Field } from "./Field";
import { CheckoutSummary } from "./CheckoutSummary";

const ease = [0.16, 1, 0.3, 1] as const;

const initialValues: CheckoutValues = {
  email: "",
  phone: "",
  firstName: "",
  lastName: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postal: "",
  country: "United States",
  cardNumber: "",
  cardExpiry: "",
  cardCvc: "",
  cardName: "",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-8 first:border-t-0 first:pt-0">
      <h2 className="text-xl font-semibold tracking-[-0.02em] text-ink">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function OptionCard({
  name,
  checked,
  onChange,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`relative flex cursor-pointer items-center gap-4 rounded-[14px] border p-4 transition-colors ${
        checked ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-subtle"
      }`}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="peer sr-only" />
      <span
        aria-hidden
        className={`grid size-5 shrink-0 place-items-center rounded-full border transition-colors peer-focus-visible:ring-4 peer-focus-visible:ring-brand-soft ${
          checked ? "border-brand bg-brand" : "border-line bg-bg"
        }`}
      >
        {checked && <span className="size-2 rounded-full bg-brand-ink" />}
      </span>
      {children}
    </label>
  );
}

export function CheckoutView() {
  const router = useRouter();
  const hydrated = useCartStore((s) => s.hydrated);
  const rawLines = useCartStore((s) => s.lines);
  const promo = useCartStore((s) => s.promo);
  const clearCart = useCartStore((s) => s.clear);

  const [values, setValues] = useState<CheckoutValues>(initialValues);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [delivery, setDelivery] = useState<Delivery>("standard");
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [status, setStatus] = useState<"idle" | "processing" | "done">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const savedAddresses = useAddressStore((s) => s.addresses);
  const user = useUserStore((s) => s.user);

  const applySavedAddress = (a: Address) => {
    const [firstName, ...rest] = a.name.split(" ");
    setValues((prev) => ({
      ...prev,
      email: prev.email || user?.email || "",
      phone: prev.phone || a.phone || user?.phone || "",
      firstName,
      lastName: rest.join(" "),
      line1: a.line1,
      line2: a.line2 ?? "",
      city: a.city,
      region: a.region,
      postal: a.postal,
      country: a.country,
    }));
    setErrors({});
  };

  const lines = resolveLines(rawLines);
  const totals = computeTotals(lines, promo, delivery);
  const standardTotals = computeTotals(lines, promo, "standard");

  const set =
    (name: keyof CheckoutValues, format?: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = format ? format(e.target.value) : e.target.value;
      setValues((prev) => ({ ...prev, [name]: value }));
      if (errors[name]) {
        const next = validateField(name, { ...values, [name]: value }, method);
        setErrors((prev) => ({ ...prev, [name]: next }));
      }
    };

  const blur = (name: keyof CheckoutValues) => () => {
    if (!values[name] && name !== "country") return;
    setErrors((prev) => ({ ...prev, [name]: validateField(name, values, method) }));
  };

  const field = (name: keyof CheckoutValues, format?: (v: string) => string) => ({
    id: `co-${name}`,
    name,
    value: values[name],
    onChange: set(name, format),
    onBlur: blur(name),
    error: errors[name],
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const nextErrors = validateAll(values, method);
    setErrors(nextErrors);
    const firstInvalid = fieldOrder.find((name) => nextErrors[name]);
    if (firstInvalid) {
      const el = document.getElementById(`co-${firstInvalid}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
      return;
    }

    setStatus("processing");
    try {
      const order = await placeOrder({
        email: values.email.trim(),
        shipping_address: {
          name: `${values.firstName.trim()} ${values.lastName.trim()}`,
          line1: values.line1.trim(),
          line2: values.line2.trim() || undefined,
          city: values.city.trim(),
          region: values.region.trim(),
          postal: values.postal.trim(),
          country: values.country,
          phone: values.phone.trim() || undefined,
        },
        delivery_method: delivery,
        payment_method: method,
        card_last4: method === "card" ? values.cardNumber.replace(/\D/g, "").slice(-4) : undefined,
        discount_code: promo ?? undefined,
      });

      setStatus("done");
      clearCart();
      router.push(`/checkout/success?order=${order.id}`);
    } catch (err) {
      setStatus("idle");
      setSubmitError(err instanceof Error ? err.message : "Failed to place order. Please try again.");
    }
  };

  if (status === "done") {
    return (
      <div role="status" className="mx-auto flex max-w-[1200px] flex-col items-center gap-3 px-4 py-32 text-center">
        <CircleNotch size={28} className="animate-spin text-brand" />
        <p className="text-[16px] text-ink">Order placed. Taking you to your confirmation.</p>
      </div>
    );
  }

  if (!hydrated) {
    return (
      <div aria-busy="true" aria-label="Loading checkout" className="mx-auto grid max-w-[1200px] animate-pulse grid-cols-1 gap-10 px-4 py-10 md:px-8 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-7">
          <div className="h-7 w-40 rounded-full bg-surface-2" />
          <div className="h-12 rounded-[12px] bg-surface-2" />
          <div className="h-12 rounded-[12px] bg-surface-2" />
          <div className="h-12 rounded-[12px] bg-surface-2" />
        </div>
        <div className="h-96 rounded-panel bg-surface-2 lg:col-span-5" />
      </div>
    );
  }

  if (lines.length === 0 && status === "idle") {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-16 md:px-8">
        <div className="flex flex-col items-start gap-4 rounded-panel bg-surface px-6 py-14 md:px-12">
          <span className="grid size-14 place-items-center rounded-full bg-brand-soft text-brand">
            <Bag size={26} />
          </span>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-ink md:text-3xl">
            Your bag is empty
          </h1>
          <p className="max-w-[46ch] text-[16px] text-subtle">
            Add something to your bag before checking out.
          </p>
          <Link
            href="/products"
            className="mt-2 rounded-full bg-ink px-6 py-3.5 text-[15px] font-medium text-bg transition hover:opacity-90"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  const processing = status === "processing";

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-8 md:px-8 md:pt-12">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-14">
        <div className="lg:order-2 lg:col-span-5">
          <div className="lg:sticky lg:top-8">
            <CheckoutSummary lines={lines} totals={totals} promo={promo} />
          </div>
        </div>

        <motion.form
          onSubmit={onSubmit}
          noValidate
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="flex flex-col gap-8 lg:order-1 lg:col-span-7"
        >
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-ink md:text-4xl">Checkout</h1>

          {submitError && (
            <p role="alert" className="rounded-[12px] bg-[#d93a3a]/10 px-4 py-3 text-[14px] text-[#b42c2c] dark:text-[#ff8a8a]">
              {submitError}
            </p>
          )}

          <fieldset disabled={processing} className="flex flex-col gap-8 disabled:opacity-70">
            <Section title="Contact">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  {...field("email")}
                  label="Email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  hint="Your receipt and order updates go here."
                  className="sm:col-span-2"
                />
                <Field
                  {...field("phone")}
                  label="Phone"
                  optional
                  type="tel"
                  autoComplete="tel"
                  placeholder="+1 312 847 1928"
                  hint="For delivery questions only."
                  className="sm:col-span-2"
                />
              </div>
            </Section>

            <Section title="Shipping address">
              {savedAddresses.length > 0 && (
                <div className="-mt-1 mb-5 flex flex-wrap items-center gap-2">
                  <span className="text-[13px] text-subtle">Saved:</span>
                  {savedAddresses.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => applySavedAddress(a)}
                      className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] font-medium text-ink transition hover:border-brand hover:bg-brand-soft"
                    >
                      {a.label}, {a.city}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field {...field("firstName")} label="First name" autoComplete="given-name" />
                <Field {...field("lastName")} label="Last name" autoComplete="family-name" />
                <Field {...field("line1")} label="Address" autoComplete="address-line1" placeholder="Street and house number" className="sm:col-span-2" />
                <Field {...field("line2")} label="Apartment, suite, etc." optional autoComplete="address-line2" className="sm:col-span-2" />
                <Field {...field("city")} label="City" autoComplete="address-level2" />
                <Field {...field("region")} label="State or province" autoComplete="address-level1" />
                <Field {...field("postal")} label="Postal code" autoComplete="postal-code" />
                <div className="flex flex-col gap-2">
                  <label htmlFor="co-country" className="text-[14px] font-medium text-ink">
                    Country
                  </label>
                  <div className="relative">
                    <select
                      id="co-country"
                      name="country"
                      autoComplete="country-name"
                      value={values.country}
                      onChange={set("country")}
                      className="w-full appearance-none rounded-[12px] border border-line bg-surface px-4 py-3 pr-10 text-[15px] text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand-soft"
                    >
                      {countries.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                    <CaretDown size={14} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-subtle" />
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Delivery">
              <div role="radiogroup" aria-label="Delivery method" className="flex flex-col gap-3">
                {deliveryOptions.map((option) => {
                  const price =
                    option.value === "express"
                      ? formatPrice(EXPRESS_SHIPPING)
                      : standardTotals.shipping === 0
                        ? "Free"
                        : formatPrice(standardTotals.shipping);
                  return (
                    <OptionCard
                      key={option.value}
                      name="delivery"
                      checked={delivery === option.value}
                      onChange={() => setDelivery(option.value)}
                    >
                      <span className="flex-1">
                        <span className="block text-[15px] font-medium text-ink">{option.label}</span>
                        <span className="block text-[14px] text-subtle">{option.eta}</span>
                      </span>
                      <span className="text-[15px] font-medium text-ink">{price}</span>
                    </OptionCard>
                  );
                })}
              </div>
            </Section>

            <Section title="Payment">
              <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <OptionCard name="payment" checked={method === "card"} onChange={() => setMethod("card")}>
                  <CreditCard size={22} className="text-ink" />
                  <span className="text-[15px] font-medium text-ink">Card</span>
                </OptionCard>
                <OptionCard
                  name="payment"
                  checked={method === "cod"}
                  onChange={() => {
                    setMethod("cod");
                    setErrors((prev) => ({ ...prev, cardNumber: undefined, cardExpiry: undefined, cardCvc: undefined, cardName: undefined }));
                  }}
                >
                  <Money size={22} className="text-ink" />
                  <span className="text-[15px] font-medium text-ink">Cash on delivery</span>
                </OptionCard>
              </div>

              <AnimatePresence initial={false} mode="wait">
                {method === "card" ? (
                  <motion.div
                    key="card"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3, ease }}
                    className="mt-5 grid grid-cols-2 gap-4 rounded-[14px] border border-line p-4 sm:p-5"
                  >
                    <Field
                      {...field("cardNumber", formatCardNumber)}
                      label="Card number"
                      inputMode="numeric"
                      autoComplete="cc-number"
                      placeholder="1234 1234 1234 1234"
                      hint="Demo mode. Use 4242 4242 4242 4242, nothing is charged."
                      className="col-span-2"
                    />
                    <Field {...field("cardExpiry", formatExpiry)} label="Expiry" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" />
                    <Field
                      {...field("cardCvc", (v) => v.replace(/\D/g, "").slice(0, 4))}
                      label="Security code"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      placeholder="CVC"
                    />
                    <Field {...field("cardName")} label="Name on card" autoComplete="cc-name" className="col-span-2" />
                  </motion.div>
                ) : (
                  <motion.p
                    key="cod"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3, ease }}
                    className="mt-5 rounded-[14px] bg-surface p-4 text-[14px] leading-relaxed text-subtle"
                  >
                    Pay in cash when your order arrives. Please have the exact amount of{" "}
                    <span className="font-medium text-ink">{formatPrice(totals.total)}</span> ready.
                  </motion.p>
                )}
              </AnimatePresence>
            </Section>
          </fieldset>

          <div className="flex flex-col gap-4 border-t border-line pt-8">
            <motion.button
              type="submit"
              disabled={processing}
              whileTap={{ scale: 0.98 }}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-brand text-[16px] font-medium text-brand-ink transition hover:opacity-90 disabled:opacity-80"
            >
              {processing ? (
                <>
                  <CircleNotch size={18} className="animate-spin" />
                  Placing your order
                </>
              ) : (
                <>
                  <LockKey size={18} />
                  Place order, {formatPrice(totals.total)}
                </>
              )}
            </motion.button>
            <p className="text-center text-[13px] text-subtle">
              By placing your order you agree to our{" "}
              <Link href="/terms" className="text-ink underline underline-offset-2">Terms</Link> and{" "}
              <Link href="/privacy" className="text-ink underline underline-offset-2">Privacy policy</Link>.
            </p>
            <Link
              href="/cart"
              className="inline-flex items-center gap-2 self-center text-[14px] font-medium text-subtle hover:text-ink"
            >
              <ArrowLeft size={14} />
              Return to bag
            </Link>
          </div>
        </motion.form>
      </div>
    </div>
  );
}

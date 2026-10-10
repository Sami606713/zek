"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import { Check, CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { Field } from "@/components/checkout/Field";
import { PasswordField } from "./PasswordField";
import { passwordStrength, registerSchema, type RegisterInput } from "@/lib/auth";
import { AuthError, register as createAccount } from "@/lib/api/auth";
import { useUserStore } from "@/store/userStore";

const safeNext = (next: string | null) => (next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
const toUsername = (name: string) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "").slice(0, 30);

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const signIn = useUserStore((s) => s.signIn);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    getFieldState,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", username: "", email: "", phone: "", password: "", terms: false },
  });

  // eslint-disable-next-line react-hooks/incompatible-library -- RHF watch drives the strength meter
  const password = watch("password");
  const strength = passwordStrength(password);

  const onSubmit = async (values: RegisterInput) => {
    setFormError(null);
    try {
      const user = await createAccount(values);
      signIn(user);
      router.push(safeNext(params.get("next")));
    } catch (e) {
      if (e instanceof AuthError && e.field) setError(e.field, { message: e.message });
      else setFormError("Something went wrong. Please try again.");
    }
  };

  const nameField = register("fullName");

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
      <h1 className="text-3xl font-semibold tracking-[-0.04em] text-ink md:text-4xl">Create your account</h1>
      <p className="mt-2 text-[15px] text-subtle">Track orders, save your bag and let ZEK remember what you like.</p>

      {formError && (
        <p role="alert" className="mt-6 flex items-start gap-2 rounded-[12px] bg-[#d93a3a]/10 px-4 py-3 text-[14px] text-[#b42c2c] dark:text-[#ff8a8a]">
          <WarningCircle size={18} className="mt-0.5 shrink-0" />
          {formError}
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 flex flex-col gap-5">
        <Field
          id="reg-name"
          label="Full name"
          autoComplete="name"
          error={errors.fullName?.message}
          {...nameField}
          onChange={(e) => {
            void nameField.onChange(e);
            // Suggest a username until the person edits it themselves.
            if (!getFieldState("username").isDirty) setValue("username", toUsername(e.target.value));
          }}
        />
        <Field id="reg-username" label="Username" autoComplete="username" hint="Letters, numbers, dots, dashes and underscores." error={errors.username?.message} {...register("username")} />
        <Field id="reg-email" label="Email" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...register("email")} />
        <Field id="reg-phone" label="Phone" optional type="tel" autoComplete="tel" hint="For WhatsApp order updates." error={errors.phone?.message} {...register("phone")} />
        <PasswordField
          id="reg-password"
          label="Password"
          autoComplete="new-password"
          error={errors.password?.message}
          hint={
            <div className="flex items-center gap-3" aria-live="polite">
              <div className="flex flex-1 gap-1" aria-hidden>
                {[1, 2, 3, 4].map((i) => (
                  <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${password && strength.score >= i ? "bg-brand" : "bg-line"}`} />
                ))}
              </div>
              <span className="w-16 text-right text-[13px] text-subtle">{password ? strength.label : "8+ chars"}</span>
            </div>
          }
          {...register("password")}
        />

        <label className="flex items-start gap-3 text-[14px] text-ink">
          <input type="checkbox" className="peer sr-only" {...register("terms")} />
          <span
            aria-hidden
            className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-[6px] border border-line bg-surface text-transparent transition peer-checked:border-brand peer-checked:bg-brand peer-checked:text-brand-ink peer-focus-visible:ring-4 peer-focus-visible:ring-brand-soft"
          >
            <Check size={12} weight="bold" />
          </span>
          <span>
            I agree to the <Link href="/terms" className="underline underline-offset-2">Terms</Link> and{" "}
            <Link href="/privacy" className="underline underline-offset-2">Privacy policy</Link>.
          </span>
        </label>
        {errors.terms && (
          <p role="alert" className="-mt-3 text-[13px] text-[#d93a3a] dark:text-[#ff8a8a]">
            {errors.terms.message}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 flex h-12 items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-medium text-bg transition hover:opacity-90 active:scale-[0.98] disabled:opacity-70"
        >
          {isSubmitting && <CircleNotch size={18} className="animate-spin" />}
          {isSubmitting ? "Creating account" : "Create account"}
        </button>
      </form>

      <p className="mt-8 text-[14px] text-subtle">
        Already have an account?{" "}
        <Link href={`/login${params.get("next") ? `?next=${encodeURIComponent(params.get("next")!)}` : ""}`} className="font-medium text-ink underline underline-offset-4">
          Log in
        </Link>
      </p>
    </motion.div>
  );
}

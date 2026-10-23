"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import { CircleNotch, EnvelopeSimple, WarningCircle } from "@phosphor-icons/react";
import { Field } from "@/components/checkout/Field";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/auth";
import { requestPasswordReset } from "@/lib/api/auth";

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });

  const onSubmit = async ({ email }: ForgotPasswordInput) => {
    setFormError(null);
    try {
      await requestPasswordReset(email);
      setSentTo(email);
    } catch {
      setFormError("Couldn't send the link right now. Please try again in a moment.");
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
      {sentTo ? (
        <div role="status">
          <span className="grid size-12 place-items-center rounded-full bg-brand-soft text-brand">
            <EnvelopeSimple size={22} weight="duotone" />
          </span>
          <h1 className="mt-6 text-3xl font-semibold tracking-[-0.04em] text-ink md:text-4xl">Check your email</h1>
          <p className="mt-3 text-[15px] text-subtle">
            If <span className="font-medium text-ink">{sentTo}</span> has a ZEK account, we&apos;ve sent a link to reset the
            password. It works for 15 minutes.
          </p>
          <p className="mt-6 text-[14px] text-subtle">
            Didn&apos;t get it? Check spam, or{" "}
            <button type="button" onClick={() => setSentTo(null)} className="font-medium text-ink underline underline-offset-4">
              try another email
            </button>
            .
          </p>
        </div>
      ) : (
        <>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-ink md:text-4xl">Reset your password</h1>
          <p className="mt-2 text-[15px] text-subtle">Enter the email you use for ZEK and we&apos;ll send you a reset link.</p>

          {formError && (
            <p role="alert" className="mt-6 flex items-start gap-2 rounded-[12px] bg-[#d93a3a]/10 px-4 py-3 text-[14px] text-[#b42c2c] dark:text-[#ff8a8a]">
              <WarningCircle size={18} className="mt-0.5 shrink-0" />
              {formError}
            </p>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 flex flex-col gap-5">
            <Field id="forgot-email" label="Email" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...register("email")} />
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 flex h-12 items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-medium text-bg transition hover:opacity-90 active:scale-[0.98] disabled:opacity-70"
            >
              {isSubmitting && <CircleNotch size={18} className="animate-spin" />}
              {isSubmitting ? "Sending" : "Send reset link"}
            </button>
          </form>
        </>
      )}

      <p className="mt-8 text-[14px] text-subtle">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-ink underline underline-offset-4">
          Back to log in
        </Link>
      </p>
    </motion.div>
  );
}

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import { CheckCircle, CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { PasswordField } from "./PasswordField";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/auth";
import { AuthError, resetPassword } from "@/lib/api/auth";

export function ResetPasswordForm() {
  const token = useSearchParams().get("token");
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: "", confirm: "" } });

  const onSubmit = async ({ password }: ResetPasswordInput) => {
    if (!token) return;
    setFormError(null);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (e) {
      setFormError(e instanceof AuthError ? e.message : "Couldn't reset your password. Please try again.");
    }
  };

  const fade = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } };

  if (!token) {
    return (
      <motion.div {...fade}>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-ink md:text-4xl">This link isn&apos;t complete</h1>
        <p className="mt-3 text-[15px] text-subtle">Open the link from the email again, or ask for a new one.</p>
        <Link href="/forgot-password" className="mt-8 inline-flex h-12 items-center rounded-full bg-ink px-6 text-[15px] font-medium text-bg transition hover:opacity-90">
          Get a new link
        </Link>
      </motion.div>
    );
  }

  if (done) {
    return (
      <motion.div {...fade} role="status">
        <span className="grid size-12 place-items-center rounded-full bg-brand-soft text-brand">
          <CheckCircle size={22} weight="duotone" />
        </span>
        <h1 className="mt-6 text-3xl font-semibold tracking-[-0.04em] text-ink md:text-4xl">Password updated</h1>
        <p className="mt-3 text-[15px] text-subtle">You&apos;re signed out on every device. Log in with your new password.</p>
        <Link href="/login" className="mt-8 inline-flex h-12 items-center rounded-full bg-ink px-6 text-[15px] font-medium text-bg transition hover:opacity-90">
          Log in
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div {...fade}>
      <h1 className="text-3xl font-semibold tracking-[-0.04em] text-ink md:text-4xl">Choose a new password</h1>
      <p className="mt-2 text-[15px] text-subtle">Use at least 8 characters. You&apos;ll be signed out on other devices.</p>

      {formError && (
        <p role="alert" className="mt-6 flex items-start gap-2 rounded-[12px] bg-[#d93a3a]/10 px-4 py-3 text-[14px] text-[#b42c2c] dark:text-[#ff8a8a]">
          <WarningCircle size={18} className="mt-0.5 shrink-0" />
          <span>
            {formError}{" "}
            {/expired|used/.test(formError) && (
              <Link href="/forgot-password" className="font-medium underline underline-offset-4">
                Get a new link
              </Link>
            )}
          </span>
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 flex flex-col gap-5">
        <PasswordField id="reset-password" label="New password" autoComplete="new-password" error={errors.password?.message} {...register("password")} />
        <PasswordField id="reset-confirm" label="Repeat new password" autoComplete="new-password" error={errors.confirm?.message} {...register("confirm")} />
        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 flex h-12 items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-medium text-bg transition hover:opacity-90 active:scale-[0.98] disabled:opacity-70"
        >
          {isSubmitting && <CircleNotch size={18} className="animate-spin" />}
          {isSubmitting ? "Saving" : "Set new password"}
        </button>
      </form>
    </motion.div>
  );
}

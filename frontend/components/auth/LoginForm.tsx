"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import { CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { Field } from "@/components/checkout/Field";
import { PasswordField } from "./PasswordField";
import { loginSchema, type LoginInput } from "@/lib/auth";
import { AuthError, login } from "@/lib/api/auth";
import { useUserStore } from "@/store/userStore";

const safeNext = (next: string | null) => (next && next.startsWith("/") && !next.startsWith("//") ? next : "/");

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const signIn = useUserStore((s) => s.signIn);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  const onSubmit = async (values: LoginInput) => {
    setFormError(null);
    try {
      const user = await login(values.email, values.password);
      signIn(user);
      router.push(safeNext(params.get("next")));
    } catch (e) {
      setFormError(e instanceof AuthError ? e.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
      <h1 className="text-3xl font-semibold tracking-[-0.04em] text-ink md:text-4xl">Welcome back</h1>
      <p className="mt-2 text-[15px] text-subtle">Log in to see your orders and pick up your chats with ZEK.</p>

      {formError && (
        <p role="alert" className="mt-6 flex items-start gap-2 rounded-[12px] bg-[#d93a3a]/10 px-4 py-3 text-[14px] text-[#b42c2c] dark:text-[#ff8a8a]">
          <WarningCircle size={18} className="mt-0.5 shrink-0" />
          {formError}
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 flex flex-col gap-5">
        <Field id="login-email" label="Email" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...register("email")} />
        <PasswordField
          id="login-password"
          label="Password"
          autoComplete="current-password"
          error={errors.password?.message}
          action={<span className="text-[13px] text-subtle">Forgot it? Reset is coming soon.</span>}
          {...register("password")}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 flex h-12 items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-medium text-bg transition hover:opacity-90 active:scale-[0.98] disabled:opacity-70"
        >
          {isSubmitting && <CircleNotch size={18} className="animate-spin" />}
          {isSubmitting ? "Logging in" : "Log in"}
        </button>
      </form>

      <p className="mt-8 text-[14px] text-subtle">
        New to ZEK?{" "}
        <Link href={`/register${params.get("next") ? `?next=${encodeURIComponent(params.get("next")!)}` : ""}`} className="font-medium text-ink underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </motion.div>
  );
}

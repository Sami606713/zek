"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";

type PasswordFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: React.ReactNode;
  action?: React.ReactNode;
};

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  { label, error, hint, action, id, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-[14px] font-medium text-ink">
          {label}
        </label>
        {action}
      </div>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`w-full rounded-[12px] border bg-surface px-4 py-3 pr-12 text-[15px] text-ink outline-none transition placeholder:text-subtle focus:border-brand focus:ring-4 focus:ring-brand-soft ${
            error ? "border-[#d93a3a]" : "border-line"
          }`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-subtle transition hover:bg-surface-2 hover:text-ink"
        >
          {visible ? <EyeSlash size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[13px] text-[#d93a3a] dark:text-[#ff8a8a]">
          {error}
        </p>
      ) : (
        hint
      )}
    </div>
  );
});

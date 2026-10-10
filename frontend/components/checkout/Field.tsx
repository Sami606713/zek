"use client";

import { forwardRef } from "react";

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
};

// Label above, input, then hint or error below. Error text replaces the hint.
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, optional, id, className = "", ...props },
  ref,
) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={id} className="text-[14px] font-medium text-ink">
        {label}
        {optional && <span className="ml-1 font-normal text-subtle">(optional)</span>}
      </label>
      <input
        ref={ref}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={`w-full rounded-[12px] border bg-surface px-4 py-3 text-[15px] text-ink outline-none transition placeholder:text-subtle focus:border-brand focus:ring-4 focus:ring-brand-soft ${
          error ? "border-[#d93a3a]" : "border-line"
        }`}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[13px] text-[#d93a3a] dark:text-[#ff8a8a]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[13px] text-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

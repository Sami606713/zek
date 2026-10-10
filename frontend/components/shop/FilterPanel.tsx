"use client";

import { Check } from "@phosphor-icons/react";
import { priceOptions, ratingOptions, type Filters } from "@/lib/productFilters";

type FilterPanelProps = {
  filters: Filters;
  onChange: (patch: Record<string, string | null>) => void;
};

function Option({
  checked,
  label,
  onClick,
  type,
}: {
  checked: boolean;
  label: string;
  onClick: () => void;
  type: "radio" | "checkbox";
}) {
  return (
    <button
      type="button"
      role={type}
      aria-checked={checked}
      onClick={onClick}
      className="group flex w-full items-center gap-3 py-2 text-left text-[15px] text-ink"
    >
      <span
        className={`grid size-5 shrink-0 place-items-center border transition-colors ${
          type === "radio" ? "rounded-full" : "rounded-[6px]"
        } ${checked ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface group-hover:border-subtle"}`}
      >
        {checked &&
          (type === "radio" ? (
            <span className="size-2 rounded-full bg-brand-ink" />
          ) : (
            <Check size={12} weight="bold" />
          ))}
      </span>
      {label}
    </button>
  );
}

export function FilterPanel({ filters, onChange }: FilterPanelProps) {
  return (
    <div className="flex flex-col gap-8">
      <fieldset>
        <legend className="mb-2 text-[14px] font-medium text-ink">Price</legend>
        <div role="radiogroup" aria-label="Price">
          {priceOptions.map((option) => (
            <Option
              key={option.value}
              type="radio"
              label={option.label}
              checked={filters.price === option.value}
              onClick={() =>
                onChange({ price: filters.price === option.value ? null : option.value })
              }
            />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-[14px] font-medium text-ink">Rating</legend>
        <div role="radiogroup" aria-label="Rating">
          {ratingOptions.map((option) => (
            <Option
              key={option.value}
              type="radio"
              label={option.label}
              checked={filters.rating === option.value}
              onClick={() =>
                onChange({ rating: filters.rating === option.value ? null : option.value })
              }
            />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-[14px] font-medium text-ink">Show only</legend>
        <Option
          type="checkbox"
          label="On sale"
          checked={filters.sale}
          onClick={() => onChange({ sale: filters.sale ? null : "1" })}
        />
        <Option
          type="checkbox"
          label="New arrivals"
          checked={filters.fresh}
          onClick={() => onChange({ new: filters.fresh ? null : "1" })}
        />
      </fieldset>
    </div>
  );
}

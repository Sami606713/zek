import { ArrowDownRight, ArrowUpRight } from "@phosphor-icons/react";
import { Card, CardContent } from "@/components/ui/card";

type StatCardProps = {
  label: string;
  value: string;
  change?: number; // fraction, e.g. 0.12 = +12%
  hint?: string;
  icon?: React.ReactNode;
};

export function StatCard({ label, value, change, hint, icon }: StatCardProps) {
  const up = (change ?? 0) >= 0;
  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] font-medium text-subtle">{label}</p>
          {icon && <span className="text-subtle">{icon}</span>}
        </div>
        <p className="text-[26px] font-semibold tracking-[-0.03em] text-ink tabular-nums">{value}</p>
        <p className="flex items-center gap-1.5 text-[12px] text-subtle">
          {change !== undefined && (
            <span className={`inline-flex items-center gap-0.5 font-medium ${up ? "text-brand" : "text-danger"}`}>
              {up ? <ArrowUpRight size={12} weight="bold" /> : <ArrowDownRight size={12} weight="bold" />}
              {Math.abs(change * 100).toFixed(1)}%
            </span>
          )}
          {hint}
        </p>
      </CardContent>
    </Card>
  );
}

import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/ssr";

export type InfoSection = { title: string; body: React.ReactNode };

/** Plain reading layout for help and legal pages. */
export function InfoPage({
  title,
  intro,
  sections,
  crumbs = [],
  updated,
  children,
}: {
  title: string;
  intro?: React.ReactNode;
  sections?: InfoSection[];
  crumbs?: { href: string; label: string }[];
  updated?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[760px] px-4 pb-24 pt-24 md:px-8 md:pt-28">
      {crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-subtle">
            {crumbs.map((c) => (
              <li key={c.href} className="flex items-center gap-1.5">
                <Link href={c.href} className="hover:text-ink">
                  {c.label}
                </Link>
                <CaretRight size={12} aria-hidden />
              </li>
            ))}
            <li aria-current="page" className="text-ink">
              {title}
            </li>
          </ol>
        </nav>
      )}
      <h1 className="text-4xl font-semibold tracking-[-0.04em] text-ink md:text-5xl">{title}</h1>
      {updated && <p className="mt-3 text-[13px] text-subtle">Last updated {updated}</p>}
      {intro && <div className="mt-5 text-[17px] leading-relaxed text-subtle">{intro}</div>}
      {children}
      {sections && (
        <div className="mt-12 flex flex-col gap-10">
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-xl font-semibold tracking-[-0.02em] text-ink">{s.title}</h2>
              <div className="mt-3 flex flex-col gap-3 text-[15px] leading-relaxed text-subtle [&_a]:font-medium [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4 [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-ink">
                {s.body}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

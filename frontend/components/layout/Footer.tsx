import Link from "next/link";
import {
  InstagramLogo,
  TiktokLogo,
  WhatsappLogo,
  XLogo,
} from "@phosphor-icons/react/ssr";
import { Logo } from "./Logo";
import { NewsletterForm } from "./NewsletterForm";
import { AskZekButton } from "@/components/agent/AskZekButton";
import { Reveal } from "@/components/motion/Reveal";

const columns = [
  {
    title: "Shop",
    links: [
      { href: "/products", label: "All products" },
      { href: "/products?sort=new", label: "New in" },
      { href: "/collections", label: "Collections" },
      { href: "/agent", label: "Ask ZEK" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/orders", label: "Track an order" },
      { href: "/help/returns", label: "Returns" },
      { href: "/help/shipping", label: "Shipping" },
      { href: "/help", label: "Help center" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
    ],
  },
];

const socials = [
  { href: "https://instagram.com", label: "Instagram", icon: InstagramLogo },
  { href: "https://x.com", label: "X", icon: XLogo },
  { href: "https://tiktok.com", label: "TikTok", icon: TiktokLogo },
  { href: "https://wa.me", label: "WhatsApp", icon: WhatsappLogo },
];

export function Footer() {
  return (
    <footer className="mt-auto overflow-hidden border-t border-line bg-surface print:hidden">
      <div className="mx-auto max-w-[1400px] px-4 pt-16 md:px-8 md:pt-20">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-5">
            <h2 className="max-w-[16ch] text-3xl font-semibold tracking-[-0.04em] text-ink md:text-4xl">
              Hear about new drops first.
            </h2>
            <div className="mt-8">
              <NewsletterForm />
            </div>
          </div>

          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-6 lg:col-start-7"
          >
            {columns.map((column) => (
              <div key={column.title}>
                <h3 className="text-[14px] font-medium text-ink">{column.title}</h3>
                <ul className="mt-4 flex flex-col gap-3">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      {link.href === "/agent" ? (
                        <AskZekButton className="text-[15px] text-subtle transition-colors hover:text-ink">
                          {link.label}
                        </AskZekButton>
                      ) : (
                        <Link
                          href={link.href}
                          className="text-[15px] text-subtle transition-colors hover:text-ink"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-16 flex flex-col-reverse items-start justify-between gap-6 border-t border-line py-6 md:flex-row md:items-center">
          <div className="flex flex-col gap-3 text-[13px] text-subtle sm:flex-row sm:items-center sm:gap-6">
            <Logo />
            <p>&copy; 2026 ZEK. All rights reserved.</p>
            <div className="flex gap-5">
              <Link href="/privacy" className="hover:text-ink">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-ink">
                Terms
              </Link>
            </div>
          </div>
          <ul className="flex gap-1">
            {socials.map(({ href, label, icon: Icon }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="grid size-10 place-items-center rounded-full text-subtle transition hover:bg-surface-2 hover:text-ink"
                >
                  <Icon size={20} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Reveal y={60}>
        <p
          aria-hidden
          className="-mb-[0.12em] select-none text-center text-[44vw] font-semibold leading-[0.8] tracking-[-0.08em] text-ink/[0.06] md:text-[38vw]"
        >
          ZEK
        </p>
      </Reveal>
    </footer>
  );
}

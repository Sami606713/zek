"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from "motion/react";
import {
  Bag,
  Heart,
  List,
  MagnifyingGlass,
  Sparkle,
  User,
  X,
} from "@phosphor-icons/react";
import { Logo } from "./Logo";
import { selectCartCount, useCartStore } from "@/store/cartStore";
import { AskZekButton } from "@/components/agent/AskZekButton";
import { useUserStore } from "@/store/userStore";
import { useWishlistStore } from "@/store/wishlistStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const links = [
  { href: "/products", label: "Shop" },
  { href: "/products?sort=new", label: "New in" },
  { href: "/collections", label: "Collections" },
  { href: "/orders", label: "Orders" },
];

const mobileOnly = [{ href: "/wishlist", label: "Wishlist" }];

const ease = [0.16, 1, 0.3, 1] as const;

export function Navbar() {
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const count = useCartStore(selectCartCount);
  const user = useUserStore((s) => s.user);
  const saved = useWishlistStore((s) => s.ids.length);
  const signOut = useUserStore((s) => s.signOut);

  // Only flips state when the threshold or direction actually changes.
  useMotionValueEvent(scrollY, "change", (y) => {
    const previous = scrollY.getPrevious() ?? 0;
    const nextScrolled = y > 12;
    const nextHidden = y > 160 && y > previous;
    if (nextScrolled !== scrolled) setScrolled(nextScrolled);
    if (nextHidden !== hidden) setHidden(nextHidden);
  });

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <motion.header
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: hidden && !open ? "-110%" : 0, opacity: 1 }}
        transition={{ duration: 0.5, ease }}
        className="fixed inset-x-0 top-0 z-40 print:hidden"
      >
        <div
          className={`transition-[background-color,border-color,backdrop-filter] duration-300 ${
            scrolled || open
              ? "border-b border-line bg-bg/80 backdrop-blur-xl"
              : "border-b border-transparent bg-transparent"
          }`}
        >
          <nav className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-6 px-4 md:h-[72px] md:px-8">
            <Logo />

            <ul
              className="hidden items-center gap-1 lg:flex"
              onMouseLeave={() => setHovered(null)}
            >
              {links.map((link) => (
                <li key={link.href} className="relative">
                  <Link
                    href={link.href}
                    onMouseEnter={() => setHovered(link.href)}
                    className="relative z-10 block rounded-full px-4 py-2 text-[14px] font-medium text-subtle transition-colors hover:text-ink"
                  >
                    {link.label}
                  </Link>
                  {hovered === link.href && (
                    <motion.span
                      layoutId="nav-hover"
                      className="absolute inset-0 rounded-full bg-surface-2"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-1 md:gap-2">
              <Link
                href="/products"
                aria-label="Search products"
                className="grid size-10 place-items-center rounded-full text-ink transition hover:bg-surface-2 active:scale-[0.96]"
              >
                <MagnifyingGlass size={20} weight="regular" />
              </Link>
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={`Account, signed in as ${user.fullName}`}
                    className="hidden size-10 place-items-center rounded-full transition hover:bg-surface-2 md:grid"
                  >
                    <span className="grid size-8 place-items-center rounded-full bg-brand-soft text-[12px] font-semibold text-brand">
                      {user.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <span className="block text-[14px] text-ink">{user.fullName}</span>
                      <span className="block text-[12px] font-normal text-subtle">{user.email}</span>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/account">Account</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/orders">Orders</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/wishlist">Wishlist</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={signOut}>Log out</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link
                  href="/login"
                  aria-label="Log in"
                  className="hidden size-10 place-items-center rounded-full text-ink transition hover:bg-surface-2 active:scale-[0.96] md:grid"
                >
                  <User size={20} weight="regular" />
                </Link>
              )}
              <Link
                href="/wishlist"
                aria-label={`Wishlist, ${saved} saved`}
                className="relative hidden size-10 place-items-center rounded-full text-ink transition hover:bg-surface-2 active:scale-[0.96] sm:grid"
              >
                <Heart size={20} weight={saved ? "fill" : "regular"} className={saved ? "text-brand" : ""} />
                {saved > 0 && (
                  <span className="absolute right-0.5 top-0.5 grid min-w-[18px] place-items-center rounded-full bg-ink px-1 text-[10px] font-semibold leading-[18px] text-bg">
                    {saved}
                  </span>
                )}
              </Link>
              <Link
                href="/cart"
                aria-label={`Cart, ${count} items`}
                className="relative grid size-10 place-items-center rounded-full text-ink transition hover:bg-surface-2 active:scale-[0.96]"
              >
                <Bag size={20} weight="regular" />
                <AnimatePresence>
                  {count > 0 && (
                    <motion.span
                      key={count}
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.4, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      className="absolute right-0.5 top-0.5 grid min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-[18px] text-brand-ink"
                    >
                      {count}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
              <AskZekButton
                aria-label="Ask ZEK"
                className="grid size-10 place-items-center rounded-full text-ink transition hover:bg-surface-2 active:scale-[0.96] md:hidden"
              >
                <Sparkle size={20} weight="fill" className="text-brand" />
              </AskZekButton>
              <AskZekButton
                aria-haspopup="dialog"
                className="ml-2 hidden items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[14px] font-medium text-bg transition hover:opacity-90 active:scale-[0.98] md:inline-flex"
              >
                <Sparkle size={16} weight="fill" />
                Ask ZEK
              </AskZekButton>
              <button
                type="button"
                aria-label={open ? "Close menu" : "Open menu"}
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className="grid size-10 place-items-center rounded-full text-ink transition hover:bg-surface-2 lg:hidden"
              >
                {open ? <X size={22} /> : <List size={22} />}
              </button>
            </div>
          </nav>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-30 bg-bg pt-20 lg:hidden"
          >
            <motion.ul
              initial="hidden"
              animate="show"
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: 0.06 } },
              }}
              className="flex flex-col gap-1 px-4"
            >
              {[...links, ...mobileOnly].map((link) => (
                <motion.li
                  key={link.href}
                  variants={{
                    hidden: { opacity: 0, y: 16 },
                    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
                  }}
                >
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block border-b border-line py-4 text-3xl font-semibold tracking-tight text-ink"
                  >
                    {link.label}
                  </Link>
                </motion.li>
              ))}
              <motion.li
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
                }}
              >
                <AskZekButton
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center gap-3 border-b border-line py-4 text-left text-3xl font-semibold tracking-tight text-brand"
                >
                  Ask ZEK
                  <Sparkle size={24} weight="fill" />
                </AskZekButton>
              </motion.li>
              <motion.li
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
                }}
                className="pt-4 text-[16px]"
              >
                {user ? (
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    <Link href="/account" onClick={() => setOpen(false)} className="font-medium text-ink">
                      Account
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        signOut();
                        setOpen(false);
                      }}
                      className="text-subtle"
                    >
                      Log out ({user.email})
                    </button>
                  </div>
                ) : (
                  <Link href="/login" onClick={() => setOpen(false)} className="font-medium text-ink">
                    Log in or create an account
                  </Link>
                )}
              </motion.li>
            </motion.ul>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

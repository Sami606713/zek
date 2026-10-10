"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { Bag, Bell, Heart, LockKey, MapPin, Package, User, UserCircle } from "@phosphor-icons/react";
import { useUserStore } from "@/store/userStore";
import { useOrderStore } from "@/store/orderStore";
import { useWishlistStore } from "@/store/wishlistStore";
import { selectCartCount, useCartStore } from "@/store/cartStore";
import { AddressesSection, PreferencesSection, ProfileSection, SecuritySection } from "./sections";

const ease = [0.16, 1, 0.3, 1] as const;

const tabs = [
  { id: "profile", label: "Profile", icon: User },
  { id: "addresses", label: "Addresses", icon: MapPin },
  { id: "security", label: "Security", icon: LockKey },
  { id: "notifications", label: "Notifications", icon: Bell },
] as const;
type Tab = (typeof tabs)[number]["id"];

const memberSince = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

export function AccountView() {
  const hydrated = useUserStore((s) => s.hydrated);
  const user = useUserStore((s) => s.user);
  const orders = useOrderStore((s) => s.orders.length);
  const saved = useWishlistStore((s) => s.ids.length);
  const inBag = useCartStore(selectCartCount);
  const [tab, setTab] = useState<Tab>("profile");

  if (!hydrated) {
    return (
      <div aria-busy="true" aria-label="Loading account" className="mx-auto max-w-[1100px] animate-pulse px-4 pb-24 pt-24 md:px-8 md:pt-28">
        <div className="h-16 w-72 rounded-full bg-surface-2" />
        <div className="mt-10 h-80 rounded-panel bg-surface-2" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-[1100px] px-4 pb-24 pt-24 md:px-8 md:pt-28">
        <div className="flex flex-col items-start gap-4 rounded-panel bg-surface px-6 py-14 md:px-12">
          <span className="grid size-14 place-items-center rounded-full bg-brand-soft text-brand">
            <UserCircle size={28} />
          </span>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-ink md:text-3xl">Log in to see your account</h1>
          <p className="max-w-[48ch] text-[16px] text-subtle">Manage your profile, saved addresses and how we contact you.</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link href="/login?next=/account" className="rounded-full bg-ink px-6 py-3.5 text-[15px] font-medium text-bg transition hover:opacity-90">
              Log in
            </Link>
            <Link href="/register?next=/account" className="rounded-full border border-line px-6 py-3.5 text-[15px] font-medium text-ink transition hover:bg-surface-2">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const initials = user.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const stats = [
    { href: "/orders", label: "Orders", value: orders, icon: Package },
    { href: "/wishlist", label: "Saved", value: saved, icon: Heart },
    { href: "/cart", label: "In bag", value: inBag, icon: Bag },
  ];

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-24 pt-24 md:px-8 md:pt-28">
      <motion.header
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
        className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between"
      >
        <div className="flex items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center rounded-full bg-brand text-xl font-semibold text-brand-ink md:size-20 md:text-2xl">
            {initials}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-semibold tracking-[-0.04em] text-ink md:text-5xl">{user.fullName}</h1>
            <p className="mt-1 truncate text-[15px] text-subtle">
              @{user.username}
              {user.createdAt && <>, member since {memberSince.format(new Date(user.createdAt))}</>}
            </p>
          </div>
        </div>
        <ul className="grid grid-cols-3 gap-2 md:flex">
          {stats.map(({ href, label, value, icon: Icon }) => (
            <li key={label}>
              <Link href={href} className="flex flex-col gap-1 rounded-[16px] bg-surface px-4 py-3 transition hover:bg-surface-2 md:min-w-[110px]">
                <span className="flex items-center gap-1.5 text-[12px] text-subtle">
                  <Icon size={14} /> {label}
                </span>
                <span className="text-xl font-semibold tabular-nums text-ink">{value}</span>
              </Link>
            </li>
          ))}
        </ul>
      </motion.header>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr] lg:gap-10">
        <nav aria-label="Account sections" className="no-scrollbar -mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
          <ul className="flex w-max gap-1 lg:sticky lg:top-28 lg:w-full lg:flex-col">
            {tabs.map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              return (
                <li key={id} className="relative">
                  <button
                    type="button"
                    aria-current={active ? "page" : undefined}
                    onClick={() => setTab(id)}
                    className={`relative z-10 flex w-full items-center gap-2.5 rounded-full px-4 py-2.5 text-[14px] font-medium transition-colors lg:rounded-[12px] ${
                      active ? "text-bg" : "text-subtle hover:text-ink"
                    }`}
                  >
                    <Icon size={18} weight={active ? "fill" : "regular"} />
                    {label}
                  </button>
                  {active && (
                    <motion.span
                      layoutId="account-tab"
                      className="absolute inset-0 rounded-full bg-ink lg:rounded-[12px]"
                      transition={{ type: "spring", stiffness: 400, damping: 34 }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}>
          {tab === "profile" && <ProfileSection user={user} />}
          {tab === "addresses" && <AddressesSection user={user} />}
          {tab === "security" && <SecuritySection user={user} />}
          {tab === "notifications" && <PreferencesSection user={user} />}
        </motion.div>
      </div>
    </div>
  );
}

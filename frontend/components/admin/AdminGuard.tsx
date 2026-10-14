"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LockKey } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { fetchProfile } from "@/lib/api/auth";
import { useUserStore } from "@/store/userStore";

type Check = { token: string; status: "admin" | "denied" | "expired" };

/**
 * Lets only admins into /admin. The session lives in localStorage, so this runs in the
 * browser (proxy.ts can't see it). The role is re-read from GET /users/me on every visit,
 * so an edited or stale local session can't unlock the panel. The backend still checks
 * every admin request on its own; this guard is about what the UI shows.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useUserStore((s) => s.hydrated);
  const token = useUserStore((s) => s.user?.token ?? "");
  const [check, setCheck] = useState<Check | null>(null);

  // The admin layout has no CartHydrator, so load the saved session here.
  useEffect(() => {
    void useUserStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (!hydrated || !token) return;
    let alive = true;
    fetchProfile(token).then(
      (profile) => {
        if (!alive) return;
        useUserStore.getState().updateUser({ role: profile.role, isAdmin: profile.isAdmin });
        setCheck({ token, status: profile.isAdmin ? "admin" : "denied" });
      },
      () => alive && setCheck({ token, status: "expired" }),
    );
    return () => {
      alive = false;
    };
  }, [hydrated, token]);

  const status = !hydrated ? "loading" : !token ? "expired" : check?.token === token ? check.status : "loading";

  useEffect(() => {
    if (status !== "expired") return;
    if (token) useUserStore.getState().signOut();
    router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, token, pathname, router]);

  if (status === "admin") return <>{children}</>;

  if (status === "denied") {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-4">
        <div className="max-w-sm text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
            <LockKey size={24} weight="duotone" />
          </span>
          <h1 className="mt-5 text-xl font-semibold tracking-[-0.02em] text-ink">Admins only</h1>
          <p className="mt-2 text-[14px] text-subtle">
            Your account doesn&apos;t have access to the admin panel. Sign in with an admin account to continue.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/">Back to store</Link>
            </Button>
            <Button
              onClick={() => {
                useUserStore.getState().signOut();
                router.replace(`/login?next=${encodeURIComponent(pathname)}`);
              }}
            >
              Switch account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <CheckingAccess />;
}

/** Shown while the role check runs (also the Suspense fallback in the admin layout). */
export function CheckingAccess() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg" aria-busy="true">
      <div className="flex items-center gap-2 text-[14px] text-subtle">
        <Spinner /> Checking access…
      </div>
    </div>
  );
}

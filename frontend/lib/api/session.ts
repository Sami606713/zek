// Keeps the shopper's login fresh. Access tokens last 30 minutes, refresh tokens 7 days:
// we swap the refresh token for a new pair shortly before the access token expires
// (and once more if a request still comes back 401). When the refresh token is no
// longer valid, the shopper is signed out with a message instead of failing silently.
//
// Uses fetch directly (not the api client) because the api client calls into here.
import { toast } from "sonner";
import { useUserStore, type SessionUser } from "@/store/userStore";
import type { ApiToken } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const REFRESH_EARLY_MS = 60_000; // refresh when less than a minute is left

/** Expiry time (ms) from a JWT's `exp` claim, or 0 if it can't be read. */
export function tokenExpiry(token: string): number {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const { exp } = JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), "=")));
    return typeof exp === "number" ? exp * 1000 : 0;
  } catch {
    return 0;
  }
}

/** The signed-in user, also before the store has loaded from storage (first requests on a page). */
function currentUser(): SessionUser | null {
  const state = useUserStore.getState();
  if (state.hydrated) return state.user;
  try {
    return JSON.parse(localStorage.getItem("zek-session") ?? "null")?.state?.user ?? null;
  } catch {
    return null;
  }
}

let inFlight: Promise<string | null> | null = null;

/**
 * Swap the refresh token for a new pair. Concurrent callers share one request, since
 * each refresh token can only be used once. Resolves to the new access token, or null
 * when the session is over (the shopper is then signed out).
 */
export function refreshSession(): Promise<string | null> {
  inFlight ??= (async () => {
    const refreshToken = currentUser()?.refreshToken;
    if (!refreshToken) return null;
    try {
      const res = await fetch(`${API_URL}/users/refresh-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (res.status === 401 || res.status === 403) {
        endSession();
        return null;
      }
      if (!res.ok) return null; // server trouble: keep the session, try again later
      const tokens = (await res.json()) as ApiToken;
      useUserStore.getState().updateUser({ token: tokens.access_token, refreshToken: tokens.refresh_token });
      return tokens.access_token;
    } catch {
      return null; // offline: keep the session
    }
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** An access token that's valid for at least another minute (refreshed if needed), or null for guests. */
export async function getValidToken(): Promise<string | null> {
  const token = currentUser()?.token;
  if (!token) return null;
  if (tokenExpiry(token) - Date.now() > REFRESH_EARLY_MS) return token;
  return (await refreshSession()) ?? (tokenExpiry(token) > Date.now() ? token : null);
}

function endSession() {
  if (!currentUser()) return;
  useUserStore.getState().signOut();
  toast.error("Your session has expired", { description: "Please sign in again to continue." });
}

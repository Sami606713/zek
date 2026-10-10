import { api } from "./client";
import { mapUser } from "./mappers";
import type { ApiToken, ApiUser } from "./types";
import type { SessionUser } from "@/store/userStore";

export class AuthError extends Error {
  constructor(
    message: string,
    public field?: "email" | "username" | "password",
  ) {
    super(message);
  }
}

function extractMessage(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && "message" in detail) {
    return String((detail as { message: unknown }).message);
  }
  return "Request failed";
}

export async function login(email: string, password: string): Promise<SessionUser> {
  try {
    const res = await api.post<ApiToken>("/users/login", { email, password });
    const user = await api.get<ApiUser>("/users/me", { auth: true });
    const session = mapUser(user);
    session.token = res.access_token;
    session.refreshToken = res.refresh_token;
    return session;
  } catch (e) {
    if (e instanceof Error) {
      throw new AuthError(e.message);
    }
    throw new AuthError("Login failed");
  }
}

export async function register(input: {
  fullName: string;
  username: string;
  email: string;
  phone?: string;
  password: string;
}): Promise<SessionUser> {
  try {
    const res = await api.post<ApiToken>("/users/register", {
      full_name: input.fullName,
      username: input.username,
      email: input.email,
      phone_number: input.phone || null,
      password: input.password,
    });
    const user = await api.get<ApiUser>("/users/me", { auth: true });
    const session = mapUser(user);
    session.token = res.access_token;
    session.refreshToken = res.refresh_token;
    return session;
  } catch (e) {
    if (e instanceof Error) {
      const msg = extractMessage((e as { message?: unknown }).message);
      const field = msg.toLowerCase().includes("email")
        ? ("email" as const)
        : msg.toLowerCase().includes("username")
          ? ("username" as const)
          : undefined;
      throw new AuthError(msg, field);
    }
    throw new AuthError("Registration failed");
  }
}

export async function fetchProfile(token: string): Promise<SessionUser> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new AuthError("Failed to load profile");
  const user = (await res.json()) as ApiUser;
  return mapUser(user);
}

export async function updateProfile(
  token: string,
  input: { fullName: string; username: string; email: string; phone?: string },
): Promise<SessionUser> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/users/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      full_name: input.fullName,
      username: input.username,
      email: input.email,
      phone_number: input.phone || null,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new AuthError(extractMessage(data?.detail) ?? "Update failed");
  }
  const user = (await res.json()) as ApiUser;
  return mapUser(user);
}

export async function changePassword(token: string, current: string, next: string): Promise<void> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/users/me/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ current_password: current, new_password: next }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new AuthError(extractMessage(data?.detail) ?? "Password change failed");
  }
}

export async function deleteAccount(token: string): Promise<void> {
  await api.delete<void>("/users/me", { auth: true });
}

export async function refreshToken(refreshToken: string): Promise<ApiToken> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/users/refresh-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) throw new AuthError("Session expired");
  return (await res.json()) as ApiToken;
}

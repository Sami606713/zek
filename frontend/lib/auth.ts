// Auth client. Mocked in localStorage until the BFF routes proxy FastAPI:
//   POST /api/v1/users/register  { username, email, password, full_name, phone_number }
//   POST /api/v1/users/login     { email, password } -> { access_token, refresh_token }
// Swap the bodies of login/register for fetch calls; the forms don't change.

import { z } from "zod";
import type { SessionUser } from "@/store/userStore";

// Mirrors backend/src/app/api/v1/schemas/user.py
export const loginSchema = z.object({
  email: z.string().trim().min(1, "Enter your email.").email("Enter a valid email, like name@example.com."),
  password: z.string().min(1, "Enter your password."),
});

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name.").max(100, "Keep it under 100 characters."),
  username: z
    .string()
    .trim()
    .min(3, "Use at least 3 characters.")
    .max(50, "Keep it under 50 characters.")
    .regex(/^[A-Za-z0-9_.-]+$/, "Letters, numbers, dots, dashes and underscores only."),
  email: z.string().trim().min(1, "Enter your email.").email("Enter a valid email, like name@example.com."),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\+?[0-9 ()-]{7,20}$/.test(v), "Enter a valid phone number."),
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .refine((v) => new TextEncoder().encode(v).length <= 72, "Password is too long."),
  terms: z.boolean().refine((v) => v, "Please accept the terms to continue."),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

type StoredUser = SessionUser & { password: string };
const KEY = "zek-mock-users";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function readUsers(): StoredUser[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export class AuthError extends Error {
  constructor(
    message: string,
    public field?: "email" | "username" | "password",
  ) {
    super(message);
  }
}

export async function login({ email, password }: LoginInput): Promise<SessionUser> {
  await sleep(700);
  const user = readUsers().find((u) => u.email === email.toLowerCase());
  // Same message for both cases so the form doesn't reveal which emails exist.
  if (!user || user.password !== password) throw new AuthError("That email and password don't match.");
  const { password: _omit, ...session } = user;
  void _omit;
  return session;
}

export async function register(input: RegisterInput): Promise<SessionUser> {
  await sleep(800);
  const users = readUsers();
  const email = input.email.toLowerCase();
  if (users.some((u) => u.email === email)) throw new AuthError("An account with this email already exists.", "email");
  if (users.some((u) => u.username.toLowerCase() === input.username.toLowerCase()))
    throw new AuthError("That username is taken. Try another.", "username");
  const user: StoredUser = {
    id: crypto.randomUUID(),
    fullName: input.fullName,
    username: input.username,
    email,
    phone: input.phone || undefined,
    createdAt: new Date().toISOString(),
    password: input.password, // mock only; the real backend stores a bcrypt hash
  };
  localStorage.setItem(KEY, JSON.stringify([...users, user]));
  const { password: _omit, ...session } = user;
  void _omit;
  return session;
}

const writeUsers = (users: StoredUser[]) => localStorage.setItem(KEY, JSON.stringify(users));

export const profileSchema = registerSchema.pick({ fullName: true, username: true, email: true, phone: true });
export type ProfileInput = z.infer<typeof profileSchema>;

export const passwordChangeSchema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    next: registerSchema.shape.password,
    confirm: z.string().min(1, "Repeat the new password."),
  })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "The passwords don't match." })
  .refine((v) => v.next !== v.current, { path: ["next"], message: "Choose a password you haven't used here." });
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;

// PUT /api/v1/users/me
export async function updateProfile(userId: string, input: ProfileInput): Promise<Partial<SessionUser>> {
  await sleep(500);
  const users = readUsers();
  const email = input.email.toLowerCase();
  if (users.some((u) => u.id !== userId && u.email === email)) throw new AuthError("Another account uses this email.", "email");
  if (users.some((u) => u.id !== userId && u.username.toLowerCase() === input.username.toLowerCase()))
    throw new AuthError("That username is taken. Try another.", "username");
  const patch = { fullName: input.fullName, username: input.username, email, phone: input.phone || undefined };
  writeUsers(users.map((u) => (u.id === userId ? { ...u, ...patch } : u)));
  return patch;
}

// POST /api/v1/users/change-password
export async function changePassword(userId: string, current: string, next: string) {
  await sleep(600);
  const users = readUsers();
  const user = users.find((u) => u.id === userId);
  if (!user || user.password !== current) throw new AuthError("Your current password is wrong.", "password");
  writeUsers(users.map((u) => (u.id === userId ? { ...u, password: next } : u)));
}

// DELETE /api/v1/users/me
export async function deleteAccount(userId: string) {
  await sleep(500);
  writeUsers(readUsers().filter((u) => u.id !== userId));
}

export function passwordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return { score, label: ["Too short", "Weak", "Fair", "Good", "Strong"][score] };
}

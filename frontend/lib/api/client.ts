const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("zek-session");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.user ? parsed.state.user.token ?? null : null;
  } catch {
    return null;
  }
}

function getSessionId(): string {
  const KEY = "zek-session-id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID().replace(/-/g, "");
    localStorage.setItem(KEY, id);
  }
  return id;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  opts: { auth?: boolean; guest?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...((options.headers as Record<string, string>) ?? {}),
  };

  if (opts.auth !== false) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  if (opts.guest) {
    headers["X-Session-Id"] = getSessionId();
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg =
      data?.detail?.message ??
      (typeof data?.detail === "string" ? data.detail : null) ??
      `Request failed (${res.status})`;
    throw new ApiError(res.status, msg);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, opts?: { auth?: boolean; guest?: boolean }) =>
    request<T>(path, { method: "GET" }, opts),
  post: <T>(path: string, body?: unknown, opts?: { auth?: boolean; guest?: boolean }) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }, opts),
  patch: <T>(path: string, body?: unknown, opts?: { auth?: boolean; guest?: boolean }) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }, opts),
  put: <T>(path: string, body?: unknown, opts?: { auth?: boolean }) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }, opts),
  delete: <T>(path: string, opts?: { auth?: boolean; guest?: boolean }) =>
    request<T>(path, { method: "DELETE" }, opts),
};

export { API_URL };

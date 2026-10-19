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

/** A fresh access token in the browser (refreshed before it expires), none on the server. */
async function getToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const { getValidToken } = await import("./session"); // browser-only: keeps it out of server renders
  return getValidToken();
}

async function refreshToken(): Promise<string | null> {
  const { refreshSession } = await import("./session");
  return refreshSession();
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
  retried = false,
): Promise<T> {
  const headers: Record<string, string> = {
    ...(typeof options.body === "string" ? { "Content-Type": "application/json" } : {}),
    ...((options.headers as Record<string, string>) ?? {}),
  };

  let sentToken = false;
  if (opts.auth !== false) {
    const token = await getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      sentToken = true;
    }
  }

  if (opts.guest) {
    headers["X-Session-Id"] = getSessionId();
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  // The login expired between the check and the request (or was revoked): refresh once and retry.
  if (res.status === 401 && sentToken && !retried && (await refreshToken())) {
    return request<T>(path, options, opts, true);
  }

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

/** Multipart upload (files). The browser sets the multipart Content-Type itself. */
export function upload<T>(path: string, fields: Record<string, string | Blob>): Promise<T> {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  return request<T>(path, { method: "POST", body }, { auth: true });
}

export { API_URL };

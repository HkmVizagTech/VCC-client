import { API_URL } from "./api";

const TOKEN_KEY = "vcc_token";

function safeStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const testKey = "__vcc_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  const storage = safeStorage();
  if (!storage) return null;
  return storage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  const storage = safeStorage();
  if (storage) storage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  const storage = safeStorage();
  if (storage) storage.removeItem(TOKEN_KEY);
}

export async function authFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
}

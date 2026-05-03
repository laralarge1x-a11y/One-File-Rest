import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

export const API_BASE: string =
  (Constants.expoConfig?.extra as any)?.apiBaseUrl ||
  "https://one-file-rest.replit.app";

const SESSION_KEY = "etok.session.cookie";

export async function setSessionCookie(cookie: string | null) {
  if (cookie) await SecureStore.setItemAsync(SESSION_KEY, cookie);
  else await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function getSessionCookie(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_KEY);
}

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, body: any, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function api<T = any>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const cookie = await getSessionCookie();
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...((init.headers as Record<string, string>) || {}),
  };
  if (init.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (cookie) headers["Cookie"] = cookie;

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  // Capture any Set-Cookie returned by the server (Discord OAuth callback,
  // session refresh, etc.) so subsequent requests stay authenticated.
  const setCookie = (res.headers as any).get?.("set-cookie");
  if (setCookie && /connect\.sid=/.test(setCookie)) {
    const match = setCookie.match(/connect\.sid=[^;]+/);
    if (match) await setSessionCookie(match[0]);
  }

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new ApiError(res.status, data, data?.error || res.statusText);
  }
  return data as T;
}

export const apiUrl = (path: string) =>
  path.startsWith("http") ? path : `${API_BASE}${path}`;

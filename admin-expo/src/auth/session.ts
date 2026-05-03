import { create } from "zustand";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { api, API_BASE, setSessionCookie } from "@/api/client";

WebBrowser.maybeCompleteAuthSession();

export interface MeUser {
  id: number;
  discord_id: string;
  discord_username: string;
  discord_avatar?: string | null;
  email?: string | null;
  role: "client" | "support" | "case_manager" | "owner" | "admin";
}

interface SessionState {
  user: MeUser | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const STAFF = ["support", "case_manager", "owner", "admin"];

export const isStaff = (u?: MeUser | null) => !!u && STAFF.includes(u.role);

export const useSession = create<SessionState>((set, get) => ({
  user: null,
  loading: true,
  error: null,

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const me = await api<MeUser>("/auth/me");
      set({ user: me, loading: false });
    } catch (err: any) {
      set({ user: null, loading: false, error: null });
    }
  },

  signIn: async () => {
    set({ loading: true, error: null });
    try {
      // Use the existing /auth/discord flow; ?native=1 makes the server
      // bounce back via the custom scheme on completion.
      const returnUrl = Linking.createURL("auth/complete");
      const authUrl = `${API_BASE}/auth/discord?native=1&return_to=${encodeURIComponent(
        returnUrl
      )}`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, returnUrl, {
        showInRecents: false,
      });
      if (result.type !== "success") {
        set({ loading: false, error: result.type === "cancel" ? null : "Sign-in cancelled" });
        return;
      }
      // Server has set the session cookie inside the WebBrowser session;
      // /auth/me will pick it up via shared cookie jar OR we re-resolve via
      // a follow-up fetch (cookies are forwarded by setSessionCookie).
      await get().refresh();
    } catch (err: any) {
      set({ loading: false, error: err?.message || "Sign-in failed" });
    }
  },

  signOut: async () => {
    try {
      await api("/auth/logout");
    } catch {}
    await setSessionCookie(null);
    set({ user: null });
  },
}));

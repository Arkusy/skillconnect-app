// utils/auth.ts
import { supabase } from "./supabase";
import type { Session } from "@supabase/supabase-js";

/**
 * Try to exchange a Supabase OAuth or magic-link URL for a session.
 * Works on both web and native, across SDK versions.
 */
export async function handleAuthUrl(url?: string | null): Promise<Session | null> {
  if (!url) return null;

  try {
    // v2 SDK (mobile deep link / universal link)
    if (typeof (supabase.auth as any).exchangeCodeForSession === "function") {
      const resp = await (supabase.auth as any).exchangeCodeForSession(url);
      if (resp?.data?.session) return resp.data.session;
      if (resp?.session) return resp.session;
    }

    // Web fallback
    if (typeof (supabase.auth as any).getSessionFromUrl === "function") {
      const resp = await (supabase.auth as any).getSessionFromUrl({ url });
      if (resp?.data?.session) return resp.data.session;
      if (resp?.session) return resp.session;
    }

    // Final fallback
    const { data } = await supabase.auth.getSession();
    return data?.session ?? null;
  } catch (err) {
    console.warn("handleAuthUrl error:", err);
    return null;
  }
}

/**
 * Safely fetch the current Supabase session.
 */
export async function getInitialSession(): Promise<Session | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session ?? null;
  } catch (err) {
    console.warn("getInitialSession error:", err);
    return null;
  }
}

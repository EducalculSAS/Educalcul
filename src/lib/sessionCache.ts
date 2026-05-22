"use client";

import { supabase } from "@/lib/supabaseClient";

/** Cache la session en mémoire — évite un aller-retour réseau à chaque navigation */
let cachedSession: any = null;
let cachedUser: any = null;
let cacheTs = 0;
const CACHE_TTL = 30_000; // 30 secondes

export async function getCachedSession() {
  const now = Date.now();
  if (cachedSession && (now - cacheTs) < CACHE_TTL) return cachedSession;

  const { data: { session } } = await supabase.auth.getSession();
  cachedSession = session;
  cacheTs = now;
  return session;
}

export async function getCachedUserData(authId: string, fields = "role, status, ban_reason, first_name, last_name") {
  const now = Date.now();
  if (cachedUser && cachedUser.auth_id === authId && (now - cacheTs) < CACHE_TTL) return cachedUser;

  const { data } = await supabase.from("users").select(fields).eq("auth_id", authId).maybeSingle();
  cachedUser = data;
  return data;
}

export function invalidateCache() {
  cachedSession = null;
  cachedUser = null;
  cacheTs = 0;
}

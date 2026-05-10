import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase.types";

type BrowserWindowWithElectronEnv = Window & {
  electronAPI?: {
    env?: {
      supabaseUrl?: string;
      supabaseAnonKey?: string;
    };
  };
};

export const SUPABASE_CONFIG_ERROR =
  "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before starting CodeSight.";

const resolveSupabaseConfig = () => {
  const electronEnv = (window as BrowserWindowWithElectronEnv).electronAPI?.env;
  const url = import.meta.env.VITE_SUPABASE_URL ?? electronEnv?.supabaseUrl ?? "";
  const anonKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY ?? electronEnv?.supabaseAnonKey ?? "";

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
};

export const hasSupabaseConfig = resolveSupabaseConfig() !== null;

const globalForSupabase = globalThis as typeof globalThis & {
  __codesightSupabase?: SupabaseClient<Database>;
};

export const createSupabaseClient = () => {
  const config = resolveSupabaseConfig();

  if (!config) {
    throw new Error(SUPABASE_CONFIG_ERROR);
  }

  const { url, anonKey } = config;

  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        "X-Client-Info": "codesight-frontend",
      },
    },
  });
};

export const supabase =
  hasSupabaseConfig
    ? (globalForSupabase.__codesightSupabase ?? createSupabaseClient())
    : null;

export const requireSupabase = () => {
  if (!supabase) {
    throw new Error(SUPABASE_CONFIG_ERROR);
  }

  return supabase;
};

if (supabase && !globalForSupabase.__codesightSupabase) {
  globalForSupabase.__codesightSupabase = supabase;
}

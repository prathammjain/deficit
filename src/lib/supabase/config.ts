/**
 * supabase/config.ts — reads Supabase connection details from the environment.
 *
 * Expo inlines any `EXPO_PUBLIC_*` variable at build time, so these come from
 * a local `.env` (see `.env.example`). When they're absent the app runs in
 * fully local, no-account mode — nothing breaks, sync is just off.
 */

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** True once both URL and anon key are provided. Gates auth + cloud sync. */
export const isSupabaseConfigured =
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

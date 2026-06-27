/**
 * supabase/client.ts — the singleton Supabase client (or null in local mode).
 *
 * On web, sessions persist in localStorage and the magic-link callback is read
 * straight out of the URL. Native persistence (AsyncStorage) is a later add for
 * the app-store build; web is the PWA target today.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from './config';

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Web magic links land back on the app URL with tokens in the hash.
        detectSessionInUrl: Platform.OS === 'web',
        // Implicit (not PKCE): magic-link emails are usually opened in a
        // different browser / in-app webview than the one that requested them,
        // where PKCE's stored code-verifier is missing and sign-in silently
        // bounces back to the login screen. Implicit carries the session in the
        // link itself, so it completes regardless of which browser opens it.
        flowType: 'implicit',
      },
    })
  : null;

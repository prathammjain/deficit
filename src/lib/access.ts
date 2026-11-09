/**
 * access.ts: free and premium, as the database reports it (`my_access()`).
 *
 * One subscription for everyone; admins can gift premium by hand. While the
 * paywall switch is off, everyone gets every feature. Pure, so it is unit
 * tested in plain Node; the network call lives in supabase/access.ts.
 */

import { shortDate } from './date';

export interface Access {
  /** The paywall switch. Off means every feature is open to everyone. */
  paywall: boolean;
  premiumSource: 'gift' | 'subscription' | null;
  /** When premium ends (ISO). Null means no end date. */
  premiumEndsAt: string | null;
  /** True while the premium row exists and hasn't ended. */
  premiumActive: boolean;
  admin: boolean;
}

/** Reads `my_access()`'s JSON. Anything missing reads as free, not admin. */
export function toAccess(raw: unknown): Access {
  const r = (raw ?? {}) as Record<string, unknown>;
  const source = r.premium_source;
  return {
    paywall: r.paywall === true,
    premiumSource:
      source === 'gift' || source === 'subscription' ? source : null,
    premiumEndsAt:
      typeof r.premium_ends_at === 'string' ? r.premium_ends_at : null,
    premiumActive: r.premium_active === true,
    admin: r.admin === true,
  };
}

/** The one check premium features use. */
export function hasPremium(a: Access): boolean {
  return !a.paywall || a.premiumActive;
}

/** The plan line on Profile, or null when there is nothing worth saying. */
export function planLine(a: Access): string | null {
  if (a.premiumActive) {
    const base =
      a.premiumSource === 'gift' ? 'Premium, a gift from Grain' : 'Premium';
    return a.premiumEndsAt
      ? `${base}, until ${shortDate(a.premiumEndsAt)}`
      : base;
  }
  return a.paywall ? 'Free' : null;
}

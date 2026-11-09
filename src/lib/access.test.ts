import { hasPremium, planLine, toAccess } from './access';
import { shortDate } from './date';

describe('toAccess', () => {
  it('reads the database answer', () => {
    const a = toAccess({
      paywall: true,
      premium_source: 'gift',
      premium_ends_at: '2027-02-08T00:00:00+00:00',
      premium_active: true,
      admin: false,
    });
    expect(a).toEqual({
      paywall: true,
      premiumSource: 'gift',
      premiumEndsAt: '2027-02-08T00:00:00+00:00',
      premiumActive: true,
      admin: false,
    });
  });

  it('reads nothing as free and not admin', () => {
    expect(toAccess(null)).toEqual({
      paywall: false,
      premiumSource: null,
      premiumEndsAt: null,
      premiumActive: false,
      admin: false,
    });
    expect(toAccess({ premium_source: 'hacked', admin: 'yes' }).admin).toBe(
      false,
    );
  });
});

describe('hasPremium', () => {
  const free = toAccess({ paywall: true });
  it('opens everything while the paywall is off', () => {
    expect(hasPremium({ ...free, paywall: false })).toBe(true);
  });
  it('needs an active premium row once the paywall is on', () => {
    expect(hasPremium(free)).toBe(false);
    expect(hasPremium({ ...free, premiumActive: true })).toBe(true);
  });
});

describe('planLine', () => {
  const base = toAccess({});
  it('says nothing while the paywall is off and there is no gift', () => {
    expect(planLine(base)).toBeNull();
  });
  it('says Free once the paywall is on', () => {
    expect(planLine({ ...base, paywall: true })).toBe('Free');
  });
  it('names a gift, with or without an end', () => {
    const gift = {
      ...base,
      premiumActive: true,
      premiumSource: 'gift' as const,
    };
    expect(planLine(gift)).toBe('Premium, a gift from Grain');
    expect(planLine({ ...gift, premiumEndsAt: '2027-02-08' })).toBe(
      'Premium, a gift from Grain, until 8 Feb 2027',
    );
  });
  it('shows a paid plan plainly', () => {
    expect(
      planLine({
        ...base,
        premiumActive: true,
        premiumSource: 'subscription',
      }),
    ).toBe('Premium');
  });
});

describe('shortDate', () => {
  it('reads a plain date as that local day', () => {
    expect(shortDate('2026-11-08')).toBe('8 Nov 2026');
  });
});

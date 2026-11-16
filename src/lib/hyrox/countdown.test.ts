import { countdown } from './countdown';

describe('countdown', () => {
  const today = '2026-11-16';

  it('counts days, with weeks once there are two or more', () => {
    expect(countdown('2026-12-09', today)).toEqual({
      days: 23,
      headline: '23 days',
      detail: '3 weeks and 2 days',
    });
    expect(countdown('2026-11-30', today).detail).toBe('2 weeks');
    expect(countdown('2026-11-24', today)).toEqual({
      days: 8,
      headline: '8 days',
      detail: null,
    });
  });

  it('says tomorrow and race day', () => {
    expect(countdown('2026-11-17', today).headline).toBe('Tomorrow');
    expect(countdown('2026-11-16', today).headline).toBe('Race day');
  });

  it('asks for the next race once this one has passed', () => {
    const c = countdown('2026-11-10', today);
    expect(c.days).toBe(-6);
    expect(c.headline).toBe('Race done');
  });
});

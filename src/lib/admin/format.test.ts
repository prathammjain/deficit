import {
  addDays,
  compact,
  followUp,
  giftEndsAt,
  growth,
  isDay,
  latestByPlatform,
  parseCount,
  share,
  totalFollowers,
  type MetricRow,
} from './format';

const row = (over: Partial<MetricRow>): MetricRow => ({
  id: Math.random().toString(36),
  creator_id: 'c1',
  platform: 'instagram',
  recorded_on: '2026-11-01',
  followers: null,
  reach: null,
  weekly_views: null,
  total_views: null,
  engagement_rate: null,
  created_at: '2026-11-01T10:00:00Z',
  ...over,
});

describe('compact', () => {
  it('writes counts the way platforms do', () => {
    expect(compact(950)).toBe('950');
    expect(compact(1234)).toBe('1.23k');
    expect(compact(48200)).toBe('48.2k');
    expect(compact(310000)).toBe('310k');
    expect(compact(1250000)).toBe('1.25M');
    expect(compact(null)).toBe('none');
  });
});

describe('parseCount', () => {
  it('reads what platforms display', () => {
    expect(parseCount('48.2K')).toBe(48200);
    expect(parseCount('1,250')).toBe(1250);
    expect(parseCount('1.2M')).toBe(1200000);
    expect(parseCount(' 900 ')).toBe(900);
  });
  it('refuses what is not a count', () => {
    expect(parseCount('')).toBeNaN();
    expect(parseCount('lots')).toBeNaN();
    expect(parseCount('12kk')).toBeNaN();
  });
});

describe('growth', () => {
  it('says up or down without a sign', () => {
    expect(growth(48200, 47000)).toBe('up 1.2k');
    expect(growth(47000, 47300)).toBe('down 300');
    expect(growth(10, 10)).toBe('no change');
    expect(growth(10, null)).toBeNull();
  });
});

describe('latestByPlatform', () => {
  const rows = [
    row({ platform: 'youtube', recorded_on: '2026-11-01', followers: 9000 }),
    row({ platform: 'instagram', recorded_on: '2026-10-01', followers: 40000 }),
    row({ platform: 'instagram', recorded_on: '2026-11-05', followers: 48200 }),
    row({ platform: 'instagram', recorded_on: '2026-10-20', followers: 45000 }),
  ];
  it('keeps the newest per platform with the one before it', () => {
    const out = latestByPlatform(rows);
    expect(out.map((p) => p.latest.platform)).toEqual(['instagram', 'youtube']);
    expect(out[0].latest.followers).toBe(48200);
    expect(out[0].previous?.followers).toBe(45000);
    expect(out[1].previous).toBeNull();
  });
  it('breaks a same day tie by the later entry', () => {
    const out = latestByPlatform([
      row({ followers: 1, created_at: '2026-11-01T09:00:00Z' }),
      row({ followers: 2, created_at: '2026-11-01T11:00:00Z' }),
    ]);
    expect(out[0].latest.followers).toBe(2);
  });
  it('adds platforms up for the total', () => {
    expect(totalFollowers(rows)).toBe(57200);
    expect(totalFollowers([])).toBe(0);
  });
});

describe('follow ups', () => {
  it('sorts a date against today', () => {
    expect(followUp('2026-11-07', '2026-11-08')).toBe('overdue');
    expect(followUp('2026-11-08', '2026-11-08')).toBe('today');
    expect(followUp('2026-11-20', '2026-11-08')).toBe('later');
    expect(followUp(null, '2026-11-08')).toBeNull();
  });
  it('adds days across a month end', () => {
    expect(addDays('2026-11-29', 3)).toBe('2026-12-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('checks a day is real', () => {
    expect(isDay('2026-11-08')).toBe(true);
    expect(isDay('2026-02-30')).toBe(false);
    expect(isDay('8 Nov')).toBe(false);
  });
});

describe('gifts and shares', () => {
  it('ends a gift months later, or never', () => {
    const now = new Date('2026-11-08T12:00:00Z');
    expect(giftEndsAt(null, now)).toBeNull();
    expect(giftEndsAt(3, now)?.slice(0, 10)).toBe('2027-02-08');
  });
  it('writes a share with its counts', () => {
    expect(share(25, 40)).toBe('63% (25 of 40)');
    expect(share(0, 0)).toBe('no one yet');
  });
});

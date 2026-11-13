import {
  buildRows,
  daysBetween,
  followerGrowth,
  funnel,
  inView,
  lastTouchByCreator,
  needsAction,
  relativeDay,
  rosterReach,
  sortRows,
  toCsv,
  urgency,
  type CreatorLike,
} from './crm';
import type { MetricRow } from './format';

const TODAY = '2026-11-09';

const creator = (over: Partial<CreatorLike>): CreatorLike => ({
  id: Math.random().toString(36).slice(2),
  name: 'Someone',
  handle: null,
  platform: 'instagram',
  niche: null,
  city: null,
  country: null,
  email: null,
  phone: null,
  stage: 'prospect',
  next_follow_up: null,
  grain_user_id: null,
  created_at: '2026-11-01T00:00:00Z',
  ...over,
});

const metric = (over: Partial<MetricRow>): MetricRow => ({
  id: Math.random().toString(36).slice(2),
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

describe('days', () => {
  it('counts whole days', () => {
    expect(daysBetween('2026-11-09', '2026-11-12')).toBe(3);
    expect(daysBetween('2026-11-09', '2026-11-02')).toBe(-7);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });
  it('says days the short way', () => {
    expect(relativeDay('2026-11-09', TODAY)).toBe('today');
    expect(relativeDay('2026-11-08', TODAY)).toBe('yesterday');
    expect(relativeDay('2026-11-10', TODAY)).toBe('tomorrow');
    expect(relativeDay('2026-11-06', TODAY)).toBe('3d ago');
    expect(relativeDay('2026-11-14', TODAY)).toBe('in 5d');
    expect(relativeDay(null, TODAY)).toBe('');
  });
});

describe('needs action and views', () => {
  it('flags due, overdue, and a reply with nothing scheduled', () => {
    expect(needsAction(creator({ next_follow_up: '2026-11-09' }), TODAY)).toBe(
      true,
    );
    expect(needsAction(creator({ next_follow_up: '2026-11-01' }), TODAY)).toBe(
      true,
    );
    expect(needsAction(creator({ stage: 'replied' }), TODAY)).toBe(true);
    expect(needsAction(creator({ next_follow_up: '2026-11-20' }), TODAY)).toBe(
      false,
    );
    expect(
      needsAction(
        creator({ stage: 'declined', next_follow_up: '2026-11-01' }),
        TODAY,
      ),
    ).toBe(false);
  });
  it('sorts creators into views', () => {
    const active = creator({ stage: 'active' });
    const declined = creator({ stage: 'declined' });
    expect(inView('roster', active, TODAY)).toBe(true);
    expect(inView('all', declined, TODAY)).toBe(false);
    expect(inView('declined', declined, TODAY)).toBe(true);
    expect(inView('prospects', creator({}), TODAY)).toBe(true);
  });
});

describe('urgency', () => {
  it('puts the most overdue first and declined last', () => {
    const order = [
      creator({ name: 'later', next_follow_up: '2026-11-20' }),
      creator({ name: 'declined', stage: 'declined' }),
      creator({ name: 'very overdue', next_follow_up: '2026-11-01' }),
      creator({ name: 'today', next_follow_up: TODAY }),
      creator({ name: 'nothing set' }),
      creator({ name: 'replied', stage: 'replied' }),
      creator({ name: 'overdue', next_follow_up: '2026-11-08' }),
    ]
      .sort((a, b) => urgency(a, TODAY) - urgency(b, TODAY))
      .map((c) => c.name);
    expect(order).toEqual([
      'very overdue',
      'overdue',
      'today',
      'replied',
      'later',
      'nothing set',
      'declined',
    ]);
  });
});

describe('growth and rows', () => {
  it('compares each platform with its previous snapshot', () => {
    const rows = [
      metric({ recorded_on: '2026-10-01', followers: 40000 }),
      metric({ recorded_on: '2026-11-01', followers: 44000 }),
      metric({ platform: 'youtube', followers: 9000 }),
    ];
    expect(followerGrowth(rows)).toBeCloseTo(10);
    expect(followerGrowth([metric({ followers: 1 })])).toBeNull();
  });
  it('builds rows with followers, growth, engagement and last contact', () => {
    const c = creator({ id: 'c1' });
    const [row] = buildRows(
      [c],
      [
        metric({ recorded_on: '2026-10-01', followers: 40000 }),
        metric({
          recorded_on: '2026-11-01',
          followers: 44000,
          engagement_rate: 4.2,
        }),
      ],
      [
        { creator_id: 'c1', happened_on: '2026-11-03' },
        { creator_id: 'c1', happened_on: '2026-11-07' },
      ],
      TODAY,
    );
    expect(row.followers).toBe(44000);
    expect(row.growth).toBeCloseTo(10);
    expect(row.engagement).toBe(4.2);
    expect(row.lastTouch).toBe('2026-11-07');
  });
  it('keeps the latest touch per creator', () => {
    const m = lastTouchByCreator([
      { creator_id: 'a', happened_on: '2026-11-01' },
      { creator_id: 'a', happened_on: '2026-11-05' },
      { creator_id: 'b', happened_on: '2026-10-01' },
    ]);
    expect(m.get('a')).toBe('2026-11-05');
    expect(m.get('b')).toBe('2026-10-01');
  });
});

describe('sortRows', () => {
  const rows = buildRows(
    [
      creator({ id: 'a', name: 'Asha', stage: 'replied' }),
      creator({ id: 'b', name: 'Bilal', next_follow_up: '2026-11-01' }),
      creator({ id: 'c', name: 'Chetan' }),
    ],
    [
      metric({ creator_id: 'a', followers: 5000 }),
      metric({ creator_id: 'c', followers: 90000 }),
    ],
    [],
    TODAY,
  );
  it('sorts by urgency by default', () => {
    expect(sortRows(rows, 'urgency', 1).map((r) => r.creator.name)).toEqual([
      'Bilal',
      'Asha',
      'Chetan',
    ]);
  });
  it('sorts by followers either way', () => {
    expect(sortRows(rows, 'followers', -1).map((r) => r.creator.name)).toEqual([
      'Chetan',
      'Asha',
      'Bilal',
    ]);
  });
  it('keeps missing values last in both directions', () => {
    for (const dir of [1, -1] as const) {
      const out = sortRows(rows, 'followUp', dir).map((r) => r.creator.name);
      expect(out[0]).toBe('Bilal');
    }
  });
});

describe('funnel and reach', () => {
  const creators = [
    creator({ stage: 'prospect' }),
    creator({ stage: 'contacted' }),
    creator({ stage: 'contacted' }),
    creator({ stage: 'replied' }),
    creator({ stage: 'active', id: 'act' }),
    creator({ stage: 'declined' }),
  ];
  it('counts how the pipeline converts', () => {
    const f = funnel(creators);
    expect(f.counts.contacted).toBe(2);
    expect(f.reached).toBe(5);
    expect(f.replied).toBe(2);
    expect(f.onboarded).toBe(1);
    expect(f.replyRate).toBeCloseTo(0.4);
    expect(funnel([]).replyRate).toBeNull();
  });
  it('adds up the roster only', () => {
    const rows = buildRows(
      creators,
      [metric({ creator_id: 'act', followers: 48200 })],
      [],
      TODAY,
    );
    expect(rosterReach(rows)).toBe(48200);
  });
});

describe('toCsv', () => {
  it('quotes what needs quoting', () => {
    expect(
      toCsv(
        ['name', 'notes'],
        [
          ['Asha', 'likes "RPE", sets'],
          ['B', null],
        ],
      ),
    ).toBe('name,notes\r\nAsha,"likes ""RPE"", sets"\r\nB,');
  });
});

describe('waiting and the new sorts', () => {
  it('waiting: a prospect nobody has started on', () => {
    expect(inView('waiting', creator({}), TODAY)).toBe(true);
    expect(inView('waiting', creator({}), TODAY, true)).toBe(false);
    expect(
      inView('waiting', creator({ next_follow_up: '2026-11-12' }), TODAY),
    ).toBe(false);
    expect(inView('waiting', creator({ stage: 'contacted' }), TODAY)).toBe(
      false,
    );
  });

  const rows = buildRows(
    [
      creator({
        id: 'a',
        name: 'Asha',
        niche: 'Powerlifting',
        created_at: '2026-11-03T09:00:00Z',
      }),
      creator({
        id: 'b',
        name: 'Bilal',
        niche: null,
        created_at: '2026-11-05T09:00:00Z',
      }),
      creator({
        id: 'c',
        name: 'Chetan',
        niche: 'Bodybuilding',
        created_at: '2026-11-01T09:00:00Z',
      }),
    ],
    [],
    [],
    TODAY,
  );
  const names = (key: 'added' | 'niche', dir: 1 | -1) =>
    sortRows(rows, key, dir).map((r) => r.creator.name);

  it('by time added, newest or oldest first', () => {
    expect(names('added', -1)).toEqual(['Bilal', 'Asha', 'Chetan']);
    expect(names('added', 1)).toEqual(['Chetan', 'Asha', 'Bilal']);
  });

  it('by niche, with no niche last either way', () => {
    expect(names('niche', 1)).toEqual(['Chetan', 'Asha', 'Bilal']);
    expect(names('niche', -1)).toEqual(['Asha', 'Chetan', 'Bilal']);
  });
});

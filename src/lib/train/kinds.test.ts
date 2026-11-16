import {
  canTick,
  isHard,
  liftsWithReps,
  placeholderFor,
  setLoad,
  setScore,
  setText,
  setVolume,
  secsText,
  type WorkSet,
} from './workout';
import {
  fromShown,
  loadNum,
  loadStep,
  setLoadUnit,
  toShown,
  volumeText,
} from './units';

const set = (v: Partial<WorkSet>): WorkSet => ({
  id: Math.random().toString(36),
  kg: null,
  reps: null,
  type: 'working',
  done: true,
  ...v,
});

describe('exercise kinds', () => {
  afterEach(() => setLoadUnit('kg'));

  it('counts bodyweight minus the help for assisted lifts', () => {
    const ex = { kind: 'assisted' as const };
    const s = set({ assist: 20, reps: 8 });
    expect(setLoad(s, ex, 80)).toBe(60);
    expect(setScore(s, ex, 80)).toBeCloseTo(60 * (1 + 8 / 30), 1);
    // Less help is a better set.
    expect(setScore(set({ assist: 10, reps: 8 }), ex, 80)).toBeGreaterThan(
      setScore(s, ex, 80),
    );
    expect(setVolume(s)).toBe(0);
    expect(setText(s, ex)).toBe('Assist 20 × 8');
    expect(canTick({ kg: null, reps: 8 }, ex)).toBe(true);
  });

  it('scores holds by seconds and distance by load times metres', () => {
    const hold = { kind: 'timed' as const };
    const carry = { kind: 'distance' as const };
    expect(setScore(set({ secs: 75 }), hold, 80)).toBe(75);
    expect(setText(set({ secs: 75, kg: 10 }), hold)).toBe('1:15 +10');
    expect(setText(set({ secs: 45 }), hold)).toBe('45s');
    expect(canTick({ kg: null, reps: null, secs: 30 }, hold)).toBe(true);
    expect(canTick({ kg: 20, reps: null }, hold)).toBe(false);

    expect(setScore(set({ kg: 32, m: 40 }), carry, 80)).toBe(1280);
    expect(setScore(set({ m: 400 }), carry, 80)).toBe(400);
    expect(setText(set({ kg: 32, m: 40 }), carry)).toBe('32 × 40 m');
    expect(canTick({ kg: 32, reps: null, m: 40 }, carry)).toBe(true);
  });

  it('counts a hold or a carry as a hard set, but moves no volume', () => {
    expect(isHard(set({ secs: 60 }))).toBe(true);
    expect(isHard(set({ m: 50, kg: 24 }))).toBe(true);
    expect(isHard(set({ secs: 60, type: 'warmup' }))).toBe(false);
    expect(setVolume(set({ m: 50, kg: 24 }))).toBe(0);
  });

  it('suggests seconds and metres from last time, not just kg and reps', () => {
    const today = [set({ done: false })];
    expect(placeholderFor(today, 0, [set({ secs: 60, kg: 5 })])).toEqual({
      kg: 5,
      reps: null,
      secs: 60,
    });
  });

  it('knows which kinds get an estimated max', () => {
    expect(liftsWithReps({ kind: 'assisted' })).toBe(true);
    expect(liftsWithReps({ kind: 'timed' })).toBe(false);
    expect(secsText(125)).toBe('2:05');
  });
});

describe('pounds', () => {
  afterEach(() => setLoadUnit('kg'));

  it('shows and takes pounds while storing kilograms', () => {
    setLoadUnit('lb');
    const kg = fromShown(225);
    expect(kg).toBeCloseTo(102.058, 3);
    expect(loadNum(kg)).toBe('225');
    expect(toShown(100)).toBeCloseTo(220.46, 2);
    expect(volumeText(1000)).toBe('2,205 lb');
    expect(loadStep()).toBeCloseTo(2.268, 3);
    expect(setText(set({ kg, reps: 5 }), { kind: 'weighted' })).toBe('225 × 5');
  });

  it('stays in kilograms by default', () => {
    expect(loadNum(62.5)).toBe('62.5');
    expect(volumeText(13935)).toBe('13,935 kg');
    expect(loadStep()).toBe(2.5);
  });
});

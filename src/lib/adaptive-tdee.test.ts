import {
  estimateAdaptiveTdee,
  recommendedTarget,
  type DailyDatum,
} from './adaptive-tdee';

/** Build a synthetic window: `days` of intake, weight every `weighEvery` days
 *  starting at `startKg` and changing by `kgPerDay`. */
function synth({
  days,
  intakeKcal,
  startKg,
  kgPerDay,
  weighEvery = 1,
}: {
  days: number;
  intakeKcal: number;
  startKg: number;
  kgPerDay: number;
  weighEvery?: number;
}): DailyDatum[] {
  const out: DailyDatum[] = [];
  const base = Date.parse('2026-05-01T00:00:00Z');
  for (let i = 0; i < days; i++) {
    const date = new Date(base + i * 86_400_000).toISOString().slice(0, 10);
    out.push({
      date,
      intakeKcal,
      weightKg: i % weighEvery === 0 ? startKg + kgPerDay * i : null,
    });
  }
  return out;
}

describe('estimateAdaptiveTdee', () => {
  it('returns confidence "none" and no estimate without enough data', () => {
    const r = estimateAdaptiveTdee(
      synth({ days: 3, intakeKcal: 2000, startKg: 85, kgPerDay: -0.07 }),
    );
    expect(r.confidence).toBe('none');
    expect(r.estimatedTdeeKcal).toBeNull();
  });

  it('backs out TDEE from intake + weight trend', () => {
    // Eat 2000/day, lose 0.5 kg/week => 0.5/7 kg/day.
    // TDEE = 2000 − (−0.5/7)*7700 = 2000 + 550 = 2550.
    const r = estimateAdaptiveTdee(
      synth({ days: 15, intakeKcal: 2000, startKg: 85, kgPerDay: -0.5 / 7 }),
    );
    expect(r.estimatedTdeeKcal).toBeCloseTo(2550, -1); // within ~10 kcal
    expect(r.trendKgPerWeek).toBeCloseTo(-0.5, 1);
    expect(r.avgIntakeKcal).toBe(2000);
    expect(r.confidence).toBe('high'); // 15 days, 15 weigh-ins, span 14
  });

  it('weight stable => TDEE ≈ maintenance (intake)', () => {
    const r = estimateAdaptiveTdee(
      synth({ days: 14, intakeKcal: 2300, startKg: 80, kgPerDay: 0 }),
    );
    expect(r.estimatedTdeeKcal).toBe(2300);
  });

  it('grades confidence by amount of data', () => {
    const low = estimateAdaptiveTdee(
      synth({
        days: 9,
        intakeKcal: 2000,
        startKg: 85,
        kgPerDay: -0.07,
        weighEvery: 2, // weigh-ins at days 0,2,4,6,8 -> span 8
      }),
    );
    expect(low.confidence).toBe('low');
  });

  it('is robust to a single noisy weigh-in (uses the slope, not endpoints)', () => {
    const data = synth({
      days: 14,
      intakeKcal: 2000,
      startKg: 85,
      kgPerDay: -0.5 / 7,
    });
    // Spike the last weigh-in by +1.5kg of water weight.
    const last = data[data.length - 1];
    if (last.weightKg != null) last.weightKg += 1.5;
    const r = estimateAdaptiveTdee(data);
    // Still clearly a loss, not flipped positive by one bad point.
    expect(r.trendKgPerWeek).toBeLessThan(0);
  });
});

describe('recommendedTarget', () => {
  it('subtracts the deficit and respects the floor', () => {
    expect(recommendedTarget(2550, 550, 1500)).toBe(2000);
    expect(recommendedTarget(1700, 550, 1500)).toBe(1500); // floor wins
  });
});

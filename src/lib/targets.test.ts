import {
  ABSOLUTE_KCAL_FLOOR,
  ACTIVITY_FACTORS,
  bmrMifflinStJeor,
  clampRate,
  computeTargets,
  macroSplit,
  MAX_RATE_KG_WEEK,
  MIN_RATE_KG_WEEK,
  tdee,
  type ProfileInput,
} from './targets';

describe('bmrMifflinStJeor', () => {
  it('matches the white-paper worked example (male, 30, 180cm, 85kg)', () => {
    // 10·85 + 6.25·180 − 5·30 + 5 = 850 + 1125 − 150 + 5 = 1830
    expect(
      bmrMifflinStJeor({ sex: 'male', weightKg: 85, heightCm: 180, age: 30 }),
    ).toBe(1830);
  });

  it('applies the female offset (−161 instead of +5)', () => {
    const male = bmrMifflinStJeor({
      sex: 'male',
      weightKg: 70,
      heightCm: 170,
      age: 28,
    });
    const female = bmrMifflinStJeor({
      sex: 'female',
      weightKg: 70,
      heightCm: 170,
      age: 28,
    });
    expect(male - female).toBe(166); // +5 − (−161)
  });
});

describe('tdee', () => {
  it('multiplies BMR by the moderate activity factor (worked example)', () => {
    // 1830 × 1.55 = 2836.5 -> rounds to 2837
    expect(tdee(1830, 'moderate')).toBe(2837);
  });

  it('uses the documented factors', () => {
    expect(ACTIVITY_FACTORS.sedentary).toBe(1.2);
    expect(ACTIVITY_FACTORS.very_active).toBe(1.9);
    expect(tdee(2000, 'sedentary')).toBe(2400);
  });
});

describe('clampRate', () => {
  it('passes through an in-range rate', () => {
    expect(clampRate(0.5)).toBe(0.5);
  });

  it('clamps an aggressive rate to the max', () => {
    expect(clampRate(2.0)).toBe(MAX_RATE_KG_WEEK);
  });

  it('clamps a too-slow rate up to the min', () => {
    expect(clampRate(0.05)).toBe(MIN_RATE_KG_WEEK);
  });

  it('falls back to the min for NaN', () => {
    expect(clampRate(Number.NaN)).toBe(MIN_RATE_KG_WEEK);
  });
});

describe('macroSplit', () => {
  it('matches the worked example macros (target 2287, 85kg)', () => {
    const { proteinG, fatG, carbsG } = macroSplit({
      targetKcal: 2287,
      weightKg: 85,
    });
    expect(proteinG).toBe(153); // 1.8 × 85
    expect(fatG).toBe(68); // 0.8 × 85
    // (2287 − 153·4 − 68·9) / 4 = (2287 − 612 − 612) / 4 = 1063/4 ≈ 266
    expect(carbsG).toBe(266);
  });

  it('honours a manual protein target', () => {
    const { proteinG } = macroSplit({
      targetKcal: 2000,
      weightKg: 85,
      proteinMode: 'manual',
      manualProteinG: 200,
    });
    expect(proteinG).toBe(200);
  });

  it('never returns negative carbs', () => {
    const { carbsG } = macroSplit({ targetKcal: 800, weightKg: 120 });
    expect(carbsG).toBeGreaterThanOrEqual(0);
  });
});

describe('computeTargets', () => {
  const baseExample: ProfileInput = {
    sex: 'male',
    age: 30,
    heightCm: 180,
    weightKg: 85,
    activityLevel: 'moderate',
    goalRateKgWeek: 0.5,
  };

  it('reproduces the full §8.5 worked example end to end', () => {
    const t = computeTargets(baseExample);
    expect(t.bmr).toBe(1830);
    expect(t.maintenanceKcal).toBe(2837);
    expect(t.dailyDeficitKcal).toBe(550); // (0.5 × 7700) / 7
    expect(t.targetKcal).toBe(2287);
    expect(t.proteinG).toBe(153);
    expect(t.fatG).toBe(68);
    expect(t.carbsG).toBe(266);
    expect(t.clamped).toBe(false);
    expect(t.safetyNote).toBeUndefined();
  });

  it('is deterministic — same input, same output', () => {
    expect(computeTargets(baseExample)).toEqual(computeTargets(baseExample));
  });

  it('never lets the target fall below the calorie floor', () => {
    // Small, sedentary person asking for an aggressive cut.
    const t = computeTargets({
      sex: 'female',
      age: 45,
      heightCm: 155,
      weightKg: 50,
      activityLevel: 'sedentary',
      goalRateKgWeek: 1.0,
    });
    const floor = Math.max(t.bmr, ABSOLUTE_KCAL_FLOOR);
    expect(t.targetKcal).toBeGreaterThanOrEqual(floor);
    expect(t.targetKcal).toBeLessThanOrEqual(t.maintenanceKcal);
    expect(t.clamped).toBe(true);
    expect(t.safetyNote).toBeDefined();
  });

  it('clamps an aggressive requested rate', () => {
    const t = computeTargets({ ...baseExample, goalRateKgWeek: 3.0 });
    expect(t.clamped).toBe(true);
    expect(t.appliedRateKgWeek).toBeLessThanOrEqual(MAX_RATE_KG_WEEK);
  });

  it('keeps the deficit consistent with the applied rate', () => {
    const t = computeTargets(baseExample);
    // deficit = applliedRate × 7700 / 7
    expect(t.dailyDeficitKcal).toBeCloseTo((t.appliedRateKgWeek * 7700) / 7, 5);
    expect(t.targetKcal).toBe(t.maintenanceKcal - t.dailyDeficitKcal);
  });
});

describe('goals', () => {
  const p: ProfileInput = {
    sex: 'male',
    age: 30,
    heightCm: 180,
    weightKg: 85,
    activityLevel: 'moderate',
    goalRateKgWeek: 0.5,
  };

  it('a profile without a goal, or with lose, gives the same numbers as before', () => {
    const before = computeTargets(p);
    expect(computeTargets({ ...p, goal: 'lose' })).toEqual(before);
    expect(before.goal).toBe('lose');
    expect(before.targetKcal).toBe(2287);
    // A loss pace or a surplus left over from another goal changes nothing.
    expect(computeTargets({ ...p, goal: 'lose', surplusShare: 0.15 })).toEqual(
      before,
    );
  });

  it('maintain eats at maintenance, whatever the old loss pace', () => {
    const t = computeTargets({ ...p, goal: 'maintain', goalRateKgWeek: 1 });
    expect(t.targetKcal).toBe(2837);
    expect(t.dailyDeficitKcal).toBe(0);
    expect(t.appliedRateKgWeek).toBe(0);
    expect(t.proteinG).toBe(153);
    expect(t.fatG).toBe(68);
    expect(t.clamped).toBe(false);
  });

  it('gain adds 10% (lean) or 15% (standard) and expects 0.25% or 0.375% a week', () => {
    const lean = computeTargets({ ...p, goal: 'gain', surplusShare: 0.1 });
    expect(lean.targetKcal).toBe(Math.round(2837 * 1.1));
    expect(lean.dailyDeficitKcal).toBe(2837 - lean.targetKcal); // negative
    expect(lean.dailyDeficitKcal).toBeLessThan(0);
    expect(lean.appliedRateKgWeek).toBeCloseTo(85 * 0.0025, 5);
    const standard = computeTargets({ ...p, goal: 'gain', surplusShare: 0.15 });
    expect(standard.targetKcal).toBe(Math.round(2837 * 1.15));
    expect(standard.appliedRateKgWeek).toBeCloseTo(85 * 0.00375, 5);
    // Protein and fat stay bodyweight driven; the surplus goes to carbs.
    expect(standard.proteinG).toBe(lean.proteinG);
    expect(standard.carbsG).toBeGreaterThan(lean.carbsG);
  });

  it('gain never goes past a 20% surplus, and defaults to lean', () => {
    const big = computeTargets({ ...p, goal: 'gain', surplusShare: 0.5 });
    expect(big.targetKcal).toBe(Math.round(2837 * 1.2));
    expect(big.clamped).toBe(true);
    const plain = computeTargets({ ...p, goal: 'gain' });
    expect(plain.targetKcal).toBe(Math.round(2837 * 1.1));
  });
});

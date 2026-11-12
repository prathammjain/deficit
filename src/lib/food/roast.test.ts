/**
 * GrainAI's verdict decides how hard a roast goes. Building muscle, a big
 * plate is the plan, so a gainer is roasted for falling behind, not for
 * eating to target.
 */
import {
  roastUserMessage,
  verdict,
  type RoastInput,
} from '../../../supabase/functions/food/roast';

const meal = (
  kcal: number,
  proteinG: number,
  day: Partial<RoastInput['day']> = {},
): RoastInput => ({
  meal: 'chicken, rice and dal',
  items: [{ name: 'Chicken rice bowl', kcal, proteinG }],
  day: {
    eatenKcalBefore: 1200,
    targetKcal: 3300,
    proteinGBefore: 60,
    proteinTargetG: 150,
    localHour: 14,
    ...day,
  },
});

describe('roast verdict', () => {
  it('losing: a 950 kcal plate is still a disaster', () => {
    expect(verdict(meal(950, 80, { targetKcal: 2200 }))).toBe('disaster');
    expect(verdict(meal(950, 80, { targetKcal: 2200, goal: 'lose' }))).toBe(
      'disaster',
    );
  });

  it('gaining: the same plate inside the target is fine', () => {
    expect(verdict(meal(950, 80, { goal: 'gain' }))).toBe('clean');
  });

  it('gaining: only well past the surplus target is a blowout', () => {
    // 1,200 + 2,300 = 3,500: about 6% over 3,300, inside the 10% margin.
    expect(verdict(meal(2300, 180, { goal: 'gain' }))).toBe('clean');
    // 2,000 + 1,800 = 3,800: 15% over.
    expect(
      verdict(meal(1800, 140, { goal: 'gain', eatenKcalBefore: 2000 })),
    ).toBe('disaster');
  });

  it('gaining: junk is still junk', () => {
    expect(verdict(meal(600, 5, { goal: 'gain' }))).toBe('disaster');
  });

  it('gaining: behind by the evening is under eating sooner than losing', () => {
    const late = { localHour: 21, eatenKcalBefore: 1700 };
    // 1,700 + 500 = 2,200: two thirds of a 3,300 target.
    expect(verdict(meal(500, 40, { ...late, goal: 'gain' }))).toBe(
      'under eating',
    );
    expect(verdict(meal(500, 40, { ...late, goal: 'lose' }))).not.toBe(
      'under eating',
    );
  });
});

describe('roast note', () => {
  it('tells the model a gainer eats a surplus on purpose', () => {
    expect(roastUserMessage(meal(950, 80, { goal: 'gain' }))).toContain(
      'goal: building muscle, eating over maintenance on purpose',
    );
    expect(roastUserMessage(meal(700, 60, { goal: 'maintain' }))).toContain(
      'goal: holding their weight at maintenance',
    );
  });

  it('says nothing new for a loss, so its roasts stay as they were', () => {
    expect(roastUserMessage(meal(700, 60))).not.toContain('goal:');
    expect(roastUserMessage(meal(700, 60, { goal: 'lose' }))).toBe(
      roastUserMessage(meal(700, 60)),
    );
  });
});

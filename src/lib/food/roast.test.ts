/**
 * GrainAI reads the room before it speaks: a roast only when the meal works
 * against the goal, real praise when it serves it, care when someone has
 * barely eaten late, and a welcome after a few quiet days. A gainer is
 * roasted for falling behind, not for eating to target.
 */
import {
  pickRoast,
  roastUserMessage,
  tone,
  type RoastInput,
} from '../../../supabase/functions/food/roast';

const meal = (
  kcal: number,
  proteinG: number,
  day: Partial<RoastInput['day']> = {},
): RoastInput => ({
  meal: 'chicken and rice',
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

describe('tone: when to roast and when not to', () => {
  it('losing: a 950 kcal plate is still roasted', () => {
    expect(tone(meal(950, 80, { targetKcal: 2200 }))).toBe('roast');
  });

  it('a clean, high protein meal gets praise, not mocked as boring', () => {
    expect(tone(meal(500, 50, { targetKcal: 2200 }))).toBe('hype');
  });

  it('the meal that hits the protein target gets praise', () => {
    // 130 + 25 = 155 g, past 150, from a meal that is only 20% protein.
    expect(tone(meal(500, 25, { proteinGBefore: 130 }))).toBe('hype');
  });

  it('a so so meal gets a light tease', () => {
    expect(tone(meal(500, 20, { targetKcal: 2200 }))).toBe('tease');
  });

  it('gaining: a big plate inside the target is praised', () => {
    expect(tone(meal(950, 80, { goal: 'gain' }))).toBe('hype');
  });

  it('gaining: only well past the surplus target is a roast', () => {
    expect(tone(meal(2300, 180, { goal: 'gain' }))).toBe('hype');
    expect(tone(meal(1800, 140, { goal: 'gain', eatenKcalBefore: 2000 }))).toBe(
      'roast',
    );
  });

  it('junk is junk on any goal', () => {
    expect(tone(meal(600, 5, { goal: 'gain' }))).toBe('roast');
  });

  it('barely eaten late in the day: care, never a roast', () => {
    expect(
      tone(
        meal(300, 5, { localHour: 21, eatenKcalBefore: 400, targetKcal: 2200 }),
      ),
    ).toBe('care');
  });

  it('gaining: behind by the evening is care sooner than losing', () => {
    const late = { localHour: 21, eatenKcalBefore: 1700 };
    expect(tone(meal(500, 40, { ...late, goal: 'gain' }))).toBe('care');
    expect(tone(meal(500, 40, { ...late, goal: 'lose' }))).not.toBe('care');
  });

  it('back after a few quiet days: a welcome, even for a pizza', () => {
    expect(tone(meal(1100, 30, { quietDays: 3, targetKcal: 2200 }))).toBe(
      'welcome',
    );
    expect(tone(meal(1100, 30, { quietDays: 1, targetKcal: 2200 }))).toBe(
      'roast',
    );
  });

  it('filling in an earlier day: the hour it is now means nothing', () => {
    const now = { localHour: 23, eatenKcalBefore: 0, targetKcal: 2200 };
    expect(tone(meal(500, 50, now))).toBe('care');
    expect(tone(meal(500, 50, { ...now, catchingUp: true }))).toBe('hype');
  });
});

describe('the note GrainAI reads', () => {
  it('tells the model a gainer eats a surplus on purpose', () => {
    expect(roastUserMessage(meal(950, 80, { goal: 'gain' }))).toContain(
      'goal: building muscle, eating over maintenance on purpose',
    );
    expect(roastUserMessage(meal(700, 60, { goal: 'maintain' }))).toContain(
      'goal: holding their weight at maintenance',
    );
  });

  it('names the mode, the protein target hit, and the first meal', () => {
    const m = roastUserMessage(
      meal(500, 25, { proteinGBefore: 130, mealsBefore: 0 }),
    );
    expect(m).toContain('mode: hype');
    expect(m).toContain('this meal just hit their protein target');
    expect(m).toContain('first meal of their day');
  });

  it('drops the time when catching up, and passes recent lines', () => {
    const m = roastUserMessage({
      ...meal(500, 50, { catchingUp: true }),
      recent: ['old joke one', 'old joke two'],
    });
    expect(m).not.toContain('time:');
    expect(m).toContain('filling in an earlier day');
    expect(m).toContain('- old joke two');
  });
});

describe('picking a line', () => {
  const first = () => 0;

  it('never swears in praise, care or a welcome', () => {
    const lines = [
      'damn, chicken and rice again, elite',
      'chicken and rice, quietly elite',
    ];
    expect(pickRoast(lines, first, { tone: 'hype' })).toBe(
      'chicken and rice, quietly elite',
    );
    expect(
      pickRoast(['damn, eat something'], first, { tone: 'care' }),
    ).toBeNull();
    expect(
      pickRoast(['damn, a whole pizza at noon'], first, { tone: 'roast' }),
    ).toBe('damn, a whole pizza at noon');
  });

  it('prefers a line without playground insults', () => {
    expect(
      pickRoast(
        ['pizza at noon, you menace', 'pizza at noon, a group order for one'],
        first,
        {
          tone: 'roast',
        },
      ),
    ).toBe('pizza at noon, a group order for one');
  });

  it('prefers a line that does not repeat a recent joke', () => {
    expect(
      pickRoast(
        [
          'your protein target filed a missing person report',
          'three donuts and zero shame',
        ],
        first,
        {
          tone: 'roast',
          recent: ['the protein target filed a missing person report again'],
        },
      ),
    ).toBe('three donuts and zero shame');
  });

  it('still drops anything about the body', () => {
    expect(
      pickRoast(['that belly needs a word'], first, { tone: 'roast' }),
    ).toBeNull();
  });
});

/**
 * Tests for the IFCT 2017 ingredient table and its raw -> cooked conversion.
 *
 * These are the first tests that reach the edge function, deliberately: this
 * is the first code in the engine that silently changes a calorie number, in
 * an app whose promise is that it doesn't make up numbers. A wrong yield
 * factor or a typo'd food code would ship ~3x calories for rice and dal with
 * nothing else to catch it.
 */
import { COOKED_YIELD, ifctSearch } from '../../../supabase/functions/food/ifct';
import { IFCT_FOODS } from '../../../supabase/functions/food/_ifct';

describe('IFCT table integrity', () => {
  it('holds every row the importer kept', () => {
    // A literal, so regenerating against a different PDF — or hand-editing the
    // generated file — fails loudly instead of quietly grounding on less.
    expect(IFCT_FOODS).toHaveLength(525);
  });

  it('has well-formed, unique food codes', () => {
    for (const f of IFCT_FOODS) expect(f.code).toMatch(/^[A-S]\d{3}$/);
    expect(new Set(IFCT_FOODS.map((f) => f.code)).size).toBe(IFCT_FOODS.length);
  });

  it('has clean names — no numeric column leaked in', () => {
    // How the first version of the parser failed: layout-mode padding meant
    // the name/value split landed mid-row for the 96 foods with no Latin
    // binomial, so eggs and milk carried their own measurements as names.
    for (const f of IFCT_FOODS) {
      expect(f.name).not.toMatch(/(?:^|\s)\d|±/);
      expect(f.name.length).toBeGreaterThan(0);
    }
  });

  it('keeps every row within plausible macro bounds', () => {
    for (const f of IFCT_FOODS) {
      expect(f.kcal).toBeGreaterThanOrEqual(10);
      expect(f.kcal).toBeLessThanOrEqual(700);
      expect(f.proteinG).toBeLessThanOrEqual(90);
      expect(f.fatG).toBeLessThanOrEqual(80);
    }
  });

  it('balances energy against macros for every row', () => {
    // The importer's Atwater gate, restated at the consumption boundary so a
    // hand-edited row cannot slip past it.
    //
    // The importer checks unrounded values. These rows are integers, and
    // rounding each macro can move the Atwater sum by up to 9 kcal
    // (0.5g x 4 + 0.5g x 4 + 0.5g x 9) — noise against a 350 kcal grain, but
    // larger than the whole figure for a 13 kcal bottle gourd. Allowing that
    // fixed slack keeps the restatement honest at both ends of the table.
    for (const f of IFCT_FOODS) {
      const atwater = 4 * f.proteinG + 4 * f.carbsG + 9 * f.fatG;
      const absGap = Math.abs(atwater - f.kcal);
      expect(absGap <= 9 || absGap / f.kcal <= 0.3).toBe(true);
    }
  });

  it('leaves the rows the importer rejected out', () => {
    // N001 is a genuine misprint in the book: skinless chicken leg published
    // at 1605 kJ (384 kcal/100g) against ~100g of accounted mass, where the
    // neighbouring thigh is 836 kJ. Pinned so a loosened gate resurfaces it.
    const codes = IFCT_FOODS.map((f) => f.code);
    expect(codes).not.toContain('N001');
    expect(codes).not.toContain('L003');
    expect(codes).not.toContain('Q001');
  });
});

describe('cooked-yield conversion', () => {
  it('only keys yields on codes that exist', () => {
    // A typo'd code silently disables the conversion and ships raw calories.
    const codes = new Set(IFCT_FOODS.map((f) => f.code));
    for (const code of Object.keys(COOKED_YIELD)) expect(codes).toContain(code);
  });

  it('converts rice to a cooked weight', () => {
    const [rice] = ifctSearch('rice');
    expect(rice.state).toBe('as-eaten');
    expect(rice.serving).toContain('cooked');
    // Raw milled rice is 356 kcal/100g; cooked is ~130 (USDA) / 133 (the
    // curated table). This fails hard if the yield is skipped or applied twice.
    expect(rice.kcal).toBeGreaterThanOrEqual(100);
    expect(rice.kcal).toBeLessThanOrEqual(160);
  });

  it('converts dal to a cooked weight', () => {
    const [dal] = ifctSearch('toor dal');
    expect(dal.id).toBe('ifct-B021'); // proves the alias map is wired, not just present
    expect(dal.state).toBe('as-eaten');
    expect(dal.kcal).toBeGreaterThanOrEqual(110);
    expect(dal.kcal).toBeLessThanOrEqual(150);
  });

  it('leaves an unconverted staple labelled raw', () => {
    const [bajra] = ifctSearch('bajra');
    expect(bajra.state).toBe('raw');
    expect(bajra.serving).toContain('raw');
    expect(bajra.kcal).toBe(348);
  });

  it('treats a food IFCT already publishes cooked as as-eaten', () => {
    // Eggs are the one cooked food in Table 1; calling them raw would be false.
    const boiled = ifctSearch('Egg, poultry, whole, boiled')[0];
    expect(boiled.state).toBe('as-eaten');
    expect(boiled.serving).toBe('100g');
    expect(boiled.kcal).toBe(148); // unconverted — no water is absorbed
  });

  it('does not mistake parboiled rice for a cooked food', () => {
    // `\bboiled\b` must not match "parboiled": the grain is still dry, and it
    // carries a yield like any other raw rice.
    const par = IFCT_FOODS.find((f) => f.code === 'A014');
    expect(par!.name).toContain('parboiled');
    expect(COOKED_YIELD.A014).toBe(3.0);
    expect(Math.round(par!.kcal / 3)).toBeLessThanOrEqual(130);
  });
});

describe('ifctSearch', () => {
  it('tags every candidate as ifct', () => {
    for (const c of ifctSearch('milk')) expect(c.source).toBe('ifct');
  });

  it('returns nothing for a blank query', () => {
    expect(ifctSearch('')).toEqual([]);
    expect(ifctSearch('   ')).toEqual([]);
  });

  it('respects the limit', () => {
    expect(ifctSearch('rice', 2)).toHaveLength(2);
  });

  it('prefixes ids so they cannot collide with the curated table', () => {
    for (const c of ifctSearch('bajra')) expect(c.id).toMatch(/^ifct-[A-S]\d{3}$/);
  });
});

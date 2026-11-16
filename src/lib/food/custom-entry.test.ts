import { checkEntry, gramsInput, macroKcal } from './custom-entry';

describe('custom entry', () => {
  it('works out calories from macros', () => {
    expect(macroKcal({ proteinG: 30, carbsG: 50, fatG: 10 })).toBe(410);
    expect(macroKcal({})).toBe(0);
  });

  it('offers the macros total when no calories were typed', () => {
    expect(checkEntry(null, { proteinG: 25, fatG: 5 })).toEqual({
      kind: 'fromMacros',
      kcal: 145,
    });
    expect(checkEntry(null, {})).toEqual({ kind: 'none' });
  });

  it('only flags a big gap between typed calories and macros', () => {
    const m = { proteinG: 30, carbsG: 50, fatG: 10 }; // 410
    expect(checkEntry(420, m)).toEqual({ kind: 'none' });
    expect(checkEntry(800, m)).toEqual({ kind: 'mismatch', kcal: 410 });
  });

  it('keeps grams to digits and one decimal', () => {
    expect(gramsInput('12')).toBe('12');
    expect(gramsInput('12,55g')).toBe('12.5');
    expect(gramsInput('1.2.3')).toBe('1.2');
    expect(gramsInput('abc')).toBe('');
  });
});

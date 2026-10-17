import {
  LocalFoodProvider,
  extractQuantity,
  splitSegments,
} from './local-provider';
import { swapParsedItem, totalMacros, type FoodItem } from './types';

const provider = new LocalFoodProvider();

describe('LocalFoodProvider.search', () => {
  it('finds an exact name', async () => {
    const r = await provider.search('rajma');
    expect(r[0].name).toBe('Rajma');
  });

  it('matches aliases (chapati -> roti)', async () => {
    const r = await provider.search('chapati');
    expect(r[0].id).toBe('roti');
  });

  it('matches partial tokens (paneer masala)', async () => {
    const r = await provider.search('paneer masala');
    expect(r.map((x) => x.id)).toContain('paneer-butter-masala');
  });

  it('returns empty for blank query', async () => {
    expect(await provider.search('   ')).toEqual([]);
  });

  it('respects the limit', async () => {
    const r = await provider.search('a', 3);
    expect(r.length).toBeLessThanOrEqual(3);
  });
});

describe('splitSegments', () => {
  it('splits on commas, "and", and plus', () => {
    expect(splitSegments('2 roti, dal and 1 katori rice + salad')).toEqual([
      '2 roti',
      'dal',
      '1 katori rice',
      'salad',
    ]);
  });
});

describe('extractQuantity', () => {
  it('reads a leading numeric quantity', () => {
    expect(extractQuantity('2 roti')).toEqual({ quantity: 2, name: 'roti' });
  });

  it('reads a word quantity and strips unit words', () => {
    expect(extractQuantity('one katori dal')).toEqual({
      quantity: 1,
      name: 'dal',
    });
  });

  it('defaults quantity to 1 and strips "of"/size words', () => {
    expect(extractQuantity('bowl of rice')).toEqual({
      quantity: 1,
      name: 'rice',
    });
  });
});

describe('parseMeal', () => {
  it('turns a free-text meal into an itemized breakdown + total', async () => {
    const parsed = await provider.parseMeal('2 roti, dal tadka, 1 katori rice');
    const ids = parsed.items.map((i) => i.item.id);
    expect(ids).toEqual(['roti', 'dal-tadka', 'rice']);
    const roti = parsed.items.find((i) => i.item.id === 'roti');
    expect(roti?.quantity).toBe(2);
    // 2×120 + 150 + 200 = 590
    expect(parsed.total.kcal).toBe(590);
  });

  it('reports items it could not match', async () => {
    const parsed = await provider.parseMeal('rajma, grandmas secret chutney');
    expect(parsed.items.map((i) => i.item.id)).toContain('rajma');
    expect(parsed.note).toMatch(/couldn’t match/i);
  });

  it('attaches a confidence to every matched item (table caps at medium)', async () => {
    const parsed = await provider.parseMeal('2 roti, dal tadka, 1 katori rice');
    for (const it of parsed.items) {
      expect(['low', 'medium']).toContain(it.confidence);
      expect(it.confidence).not.toBe('high'); // only the AI backend earns 'high'
    }
  });

  it('offers alternates so a wrong match is a one-tap fix', async () => {
    // "dal" hits dal-tadka (alias) plus dal-makhani/dal-khichdi by substring.
    const [dal] = (await provider.parseMeal('dal')).items;
    expect(dal.item.id).toBe('dal-tadka');
    expect(dal.alternates?.some((a) => a.id === 'dal-makhani')).toBe(true);
    expect(dal.alternates?.some((a) => a.id === dal.item.id)).toBe(false);
  });
});

describe('totalMacros', () => {
  it('scales by quantity and sums', () => {
    const roti: FoodItem = {
      id: 'roti',
      name: 'Roti',
      serving: '1',
      kcal: 120,
      proteinG: 3,
      carbsG: 18,
      fatG: 3,
    };
    const dal: FoodItem = {
      id: 'dal',
      name: 'Dal',
      serving: '1 katori',
      kcal: 150,
      proteinG: 8,
      carbsG: 20,
      fatG: 4,
    };
    const total = totalMacros([
      { item: roti, quantity: 2 },
      { item: dal, quantity: 1 },
    ]);
    expect(total.kcal).toBe(390); // 240 + 150
    expect(total.proteinG).toBe(14); // 6 + 8
  });
});

describe('swapParsedItem', () => {
  const katori = {
    id: 'dal-tadka',
    name: 'Dal Tadka',
    serving: '1 katori (150g)',
    kcal: 150,
    proteinG: 8,
    carbsG: 20,
    fatG: 4,
    source: 'local' as const,
  };
  const perHundredRaw = {
    id: 'ifct-B021-raw',
    name: 'Red gram, dal',
    serving: '100g raw (uncooked weight)',
    kcal: 331,
    proteinG: 22,
    carbsG: 55,
    fatG: 2,
    source: 'ifct' as const,
  };
  const sameServing = { ...katori, id: 'dal-makhani', name: 'Dal Makhani', kcal: 280 };

  const parsed = {
    item: katori,
    quantity: 1.5,
    confidence: 'low' as const,
    alternates: [perHundredRaw, sameServing],
  };

  it('resets the portion when the serving changes', () => {
    // 1.5 used to carry over onto a per-100g raw row: 1.5 x 331 = 497 kcal
    // logged for what was 1.5 katori, and badged 'high'.
    const out = swapParsedItem(parsed, perHundredRaw);
    expect(out.quantity).toBe(1);
    expect(out.item.id).toBe('ifct-B021-raw');
  });

  it('does not claim high confidence for a portion nobody confirmed', () => {
    const out = swapParsedItem(parsed, perHundredRaw);
    expect(out.confidence).toBe('medium');
    expect(out.reason).toContain('Portion reset');
    expect(out.reason).toContain('100g raw');
  });

  it('keeps the portion when the serving is identical', () => {
    // Swapping Dal Tadka for Dal Makhani, both "1 katori (150g)": 1.5 still
    // means 1.5 katori, so resetting it would silently cut the entry.
    const out = swapParsedItem(parsed, sameServing);
    expect(out.quantity).toBe(1.5);
    expect(out.confidence).toBe('high');
    expect(out.reason).toBeUndefined();
  });

  it('offers the replaced food back, without duplicating the chosen one', () => {
    const out = swapParsedItem(parsed, perHundredRaw);
    const ids = (out.alternates ?? []).map((a) => a.id);
    expect(ids).toContain('dal-tadka'); // the one it replaced
    expect(ids).not.toContain('ifct-B021-raw'); // now the chosen item
  });

  it('leaves the original item untouched', () => {
    const before = JSON.stringify(parsed);
    swapParsedItem(parsed, perHundredRaw);
    expect(JSON.stringify(parsed)).toBe(before);
  });
});

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

  it('splits sentences on a period', () => {
    expect(splitSegments('2 roti. 1 katori dal.')).toEqual([
      '2 roti',
      '1 katori dal',
    ]);
  });

  it('never splits a decimal point', () => {
    expect(splitSegments('1.5 roti')).toEqual(['1.5 roti']);
    expect(splitSegments('0.07 paneer raw')).toEqual(['0.07 paneer raw']);
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

  it('keeps a stated gram amount, joined or separated', () => {
    expect(extractQuantity('150g chicken')).toEqual({
      quantity: 1,
      name: 'chicken',
      measured: { amount: 150, unit: 'g' },
    });
    expect(extractQuantity('200 g paneer')).toEqual({
      quantity: 1,
      name: 'paneer',
      measured: { amount: 200, unit: 'g' },
    });
  });

  it('reads kg as grams and keeps ml as ml', () => {
    expect(extractQuantity('1.5kg rice').measured).toEqual({
      amount: 1500,
      unit: 'g',
    });
    expect(extractQuantity('250ml milk').measured).toEqual({
      amount: 250,
      unit: 'ml',
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

  it('reads a decimal count of a countable serving', async () => {
    const [roti] = (await provider.parseMeal('1.5 roti')).items;
    expect(roti.item.id).toBe('roti');
    expect(roti.quantity).toBe(1.5); // was 5 rotis
  });

  it('reads a decimal multiple of a per-100g serving', async () => {
    const [paneer] = (await provider.parseMeal('0.07 paneer raw')).items;
    expect(paneer.item.id).toBe('paneer-raw');
    expect(paneer.quantity).toBe(0.07); // 7 g, was 700 g
  });

  it('maps grams onto a per-100g serving as grams / 100', async () => {
    const [tikka] = (await provider.parseMeal('150g chicken tikka')).items;
    expect(tikka.item.serving).toBe('100g');
    expect(tikka.quantity).toBe(1.5);
  });

  it('scales grams by the weight a serving declares', async () => {
    // Roti is "1 piece (40g)": 60 g is 1.5 pieces.
    const [roti] = (await provider.parseMeal('60 g roti')).items;
    expect(roti.item.serving).toBe('1 piece (40g)');
    expect(roti.quantity).toBe(1.5);
    expect(roti.confidence).toBe('medium'); // no surer than "1.5 roti"
  });

  it('declines to scale grams against a serving with no weight', async () => {
    // Chai is "1 cup": no weight to divide by, so no number is invented.
    const [chai] = (await provider.parseMeal('300g chai')).items;
    expect(chai.item.serving).toBe('1 cup');
    expect(chai.quantity).toBe(1);
    expect(chai.confidence).toBe('low');
    expect(chai.reason).toContain('300 g');
  });

  it('declines to scale ml against a serving weighed in grams', async () => {
    const [paneer] = (await provider.parseMeal('100ml paneer raw')).items;
    expect(paneer.item.serving).toBe('100g');
    expect(paneer.quantity).toBe(1);
    expect(paneer.confidence).toBe('low');
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

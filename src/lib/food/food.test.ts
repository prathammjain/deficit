import {
  LocalFoodProvider,
  extractQuantity,
  splitSegments,
} from './local-provider';
import { totalMacros, type FoodItem } from './types';

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

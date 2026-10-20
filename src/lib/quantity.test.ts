import {
  isWeighed,
  quantityLabel,
  stepperLabel,
  stepQuantity,
} from './quantity';

describe('isWeighed', () => {
  it('recognises per-100 servings from every source', () => {
    expect(isWeighed('100g')).toBe(true); // USDA
    expect(isWeighed('100g cooked')).toBe(true); // IFCT, converted
    expect(isWeighed('100g raw (uncooked weight)')).toBe(true); // IFCT, raw
    expect(isWeighed('100 ml')).toBe(true);
  });

  it('treats home servings as countable, even when they name a weight', () => {
    expect(isWeighed('1 katori (150g)')).toBe(false);
    expect(isWeighed('1 piece (40g)')).toBe(false);
    expect(isWeighed('1 cup (250ml)')).toBe(false);
    expect(isWeighed(undefined)).toBe(false);
    expect(isWeighed('')).toBe(false);
  });
});

describe('stepQuantity — weighed servings move in 5 g', () => {
  it('moves an off-grid engine value to the neighbouring 5 g', () => {
    expect(stepQuantity('100g', 0.07, 1)).toBe(0.1); // 7 g -> 10 g
    expect(stepQuantity('100g', 0.07, -1)).toBe(0.05); // 7 g -> 5 g
  });

  it('steps cleanly along the grid without float noise', () => {
    expect(stepQuantity('100g', 0.15, 1)).toBe(0.2);
    expect(stepQuantity('100g', 0.15, -1)).toBe(0.1);
    expect(stepQuantity('100g raw (uncooked weight)', 1.2, 1)).toBe(1.25);
    expect(stepQuantity('100g raw (uncooked weight)', 1.2, -1)).toBe(1.15);
  });

  it('never jumps a small amount UP when "−" is pressed', () => {
    // The bug's second face: "−" on 7 g used to land on 50 g.
    expect(stepQuantity('100g', 0.05, -1)).toBe(0.05);
    expect(stepQuantity('100g', 0.02, -1)).toBe(0.02);
    expect(stepQuantity('100g', 0.02, 1)).toBe(0.05);
  });
});

describe('stepQuantity — countable servings keep their half-steps', () => {
  it('steps by half a serving', () => {
    expect(stepQuantity('1 katori (150g)', 1.5, 1)).toBe(2);
    expect(stepQuantity('1 katori (150g)', 1.5, -1)).toBe(1);
    expect(stepQuantity('1 piece (40g)', 1, -1)).toBe(0.5);
  });

  it('moves an off-grid engine value to the neighbouring half', () => {
    expect(stepQuantity('1 katori (150g)', 1.25, 1)).toBe(1.5);
    expect(stepQuantity('1 katori (150g)', 1.25, -1)).toBe(1);
  });

  it('holds at half a serving rather than reaching zero', () => {
    expect(stepQuantity('1 katori (150g)', 0.5, -1)).toBe(0.5);
  });
});

describe('stepQuantity — a press never moves the wrong way', () => {
  const values = [0.01, 0.02, 0.05, 0.07, 0.14, 0.5, 1, 1.2, 1.25, 2.5, 3];
  for (const serving of ['100g', '1 katori (150g)']) {
    it(`holds for ${serving}`, () => {
      for (const v of values) {
        expect(stepQuantity(serving, v, 1)).toBeGreaterThan(v);
        expect(stepQuantity(serving, v, -1)).toBeLessThanOrEqual(v);
      }
    });
  }
});

describe('quantityLabel', () => {
  it('shows a weighed portion in grams', () => {
    expect(quantityLabel('100g', 0.07)).toBe('7 g');
  });

  it('keeps the cooked/raw basis, because it changes what the grams mean', () => {
    expect(quantityLabel('100g cooked', 1.5)).toBe('150 g cooked');
    expect(quantityLabel('100g raw (uncooked weight)', 1.2)).toBe(
      '120 g raw (uncooked weight)',
    );
  });

  it('uses ml for a per-100 ml serving', () => {
    expect(quantityLabel('100 ml', 1.2)).toBe('120 ml');
  });

  it('shows a countable portion as a multiple of its serving', () => {
    expect(quantityLabel('1 katori (150g)', 1.5)).toBe('1.5 × 1 katori (150g)');
  });
});

describe('stepperLabel', () => {
  it('shows grams for weighed and a plain number for countable', () => {
    expect(stepperLabel('100g', 0.07)).toBe('7 g');
    expect(stepperLabel('1 katori (150g)', 1.5)).toBe('1.5');
  });

  it('trims an engine fraction to two decimals', () => {
    expect(stepperLabel('1 katori', 1.3333)).toBe('1.33');
  });
});

/**
 * units.ts: kilograms or pounds for training weights. Everything is stored
 * in kilograms; pounds are only how a load is shown and typed. Bodyweight
 * and food stay metric.
 *
 * The choice lives in training settings and is set here once it loads, so
 * any screen can format a load without passing the unit around.
 */

export type LoadUnit = 'kg' | 'lb';

/** Kilograms in a pound, exactly. */
export const KG_PER_LB = 0.45359237;

let current: LoadUnit = 'kg';

export function setLoadUnit(unit: LoadUnit | undefined) {
  current = unit === 'lb' ? 'lb' : 'kg';
}

export const loadUnit = (): LoadUnit => current;

/** A stored kilogram value in the chosen unit. */
export function toShown(kg: number, unit: LoadUnit = current): number {
  return unit === 'lb' ? kg / KG_PER_LB : kg;
}

/** A typed value in the chosen unit, back to kilograms. */
export function fromShown(n: number, unit: LoadUnit = current): number {
  return unit === 'lb' ? n * KG_PER_LB : n;
}

/** "80", "62.5", "225": two decimals in kg, one in lb, no trailing zeros. */
export function loadNum(kg: number, unit: LoadUnit = current): string {
  const v = toShown(kg, unit);
  const r = unit === 'lb' ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100;
  return String(r);
}

/** "80 kg" or "225 lb". */
export const loadText = (kg: number, unit: LoadUnit = current) =>
  `${loadNum(kg, unit)} ${unit}`;

/** "13,935 kg": totals, rounded to whole units. */
export const volumeText = (kg: number, unit: LoadUnit = current) =>
  `${Math.round(toShown(kg, unit)).toLocaleString('en-US')} ${unit}`;

/** The plus and minus step for a load: 2.5 kg or 5 lb, in kilograms. */
export const loadStep = (unit: LoadUnit = current) =>
  unit === 'lb' ? 5 * KG_PER_LB : 2.5;

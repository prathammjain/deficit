import type { LogEntry } from '@/lib/log-store';
import { isWeighed, stepperLabel, stepQuantity } from '@/lib/quantity';

import { FoodLine } from './meal-bits';

export function MealRow({
  entry,
  onQty,
  onRemove,
}: {
  entry: LogEntry;
  onQty: (q: number) => void;
  onRemove: () => void;
}) {
  const portioned = entry.unitKcal != null && entry.quantity != null;
  return (
    <FoodLine
      name={entry.label}
      kcal={entry.kcal}
      // Quiet by default; flag only the genuinely uncertain ones.
      flagged={entry.confidence === 'low'}
      meta={[
        portioned && !isWeighed(entry.serving) ? entry.serving : null,
        entry.proteinG != null ? `${entry.proteinG} g protein` : null,
        !portioned && entry.proteinG == null ? 'Custom' : null,
      ]}
      stepper={
        portioned
          ? {
              label: stepperLabel(entry.serving, entry.quantity as number),
              onStep: (dir) =>
                onQty(
                  stepQuantity(entry.serving, entry.quantity as number, dir),
                ),
            }
          : undefined
      }
      onRemove={onRemove}
    />
  );
}

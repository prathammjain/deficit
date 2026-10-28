/**
 * week-card.ts — draws the weekly card as a 1080 x 1350 PNG (Instagram's
 * portrait size) and hands it to the phone's share sheet.
 *
 * Drawn on a canvas rather than screenshotted from the page, so the image is
 * identical on every phone and the preview in the app is the shared file
 * itself. Web only, like the rest of the PWA.
 */

import { palette } from '@/constants/palette';

import { formatWeekRange, type WeekReport } from './week-report';

const W = 1080;
const H = 1350;
const PAD = 96;
const SANS = 'Satoshi, ui-sans-serif, system-ui, sans-serif';
const DOTS = 'Doto, Satoshi, ui-sans-serif, system-ui, sans-serif';

export async function drawWeekCard(r: WeekReport): Promise<Blob> {
  await loadFonts();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

  const text = (
    s: string,
    x: number,
    y: number,
    font: string,
    color: string,
    align: CanvasTextAlign = 'left',
  ) => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
  };

  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, W, H);

  // Header: wordmark and the dates.
  tracked(ctx, 'GRAIN', PAD, 150, `700 30px ${SANS}`, palette.accent, 7);
  text(
    formatWeekRange(r.from, r.to),
    W - PAD,
    150,
    `500 32px ${SANS}`,
    palette.textMuted,
    'right',
  );

  // Hero: the week's deficit (or surplus), sized down to fit if it's long.
  const surplus = r.totalDeficitKcal < 0;
  text(
    surplus ? 'Surplus this week' : 'Deficit this week',
    PAD,
    330,
    `500 40px ${SANS}`,
    palette.textMuted,
  );
  const hero = Math.abs(r.totalDeficitKcal).toLocaleString();
  const unitFont = `600 48px ${SANS}`;
  ctx.font = unitFont;
  const unitW = ctx.measureText('kcal').width;
  let size = 200;
  ctx.font = `800 ${size}px ${DOTS}`;
  while (ctx.measureText(hero).width + 24 + unitW > W - PAD * 2 && size > 80) {
    size -= 8;
    ctx.font = `800 ${size}px ${DOTS}`;
  }
  const heroW = ctx.measureText(hero).width;
  text(
    hero,
    PAD,
    540,
    `800 ${size}px ${DOTS}`,
    surplus ? palette.accent : palette.text,
  );
  text('kcal', PAD + heroW + 24, 540, unitFont, palette.textFaint);
  text(
    `Worth about ${Math.abs(r.estFatLossKg).toFixed(1)} kg of fat`,
    PAD,
    640,
    `600 38px ${SANS}`,
    palette.textMuted,
  );

  ctx.fillStyle = palette.hairline;
  ctx.fillRect(PAD, 712, W - PAD * 2, 2);

  // Four stats in a two by two grid.
  const weight =
    r.weightChangeKg != null
      ? {
          value: `${Math.abs(r.weightChangeKg).toFixed(1)} kg`,
          label:
            r.weightChangeKg < 0
              ? 'Weight down'
              : r.weightChangeKg > 0
                ? 'Weight up'
                : 'Weight steady',
        }
      : { value: `${r.avgProteinG ?? 0} g`, label: 'Average protein' };
  const stats = [
    { value: `${r.daysLogged} of 7`, label: 'Days logged' },
    { value: `${r.proteinDays} of ${r.daysLogged}`, label: 'Days protein hit' },
    {
      value: (r.avgKcal ?? 0).toLocaleString(),
      label: `Average kcal, target ${r.targetKcal.toLocaleString()}`,
    },
    weight,
  ];
  stats.forEach((st, i) => {
    const x = PAD + (i % 2) * ((W - PAD * 2) / 2);
    const y = 840 + Math.floor(i / 2) * 210;
    text(st.value, x, y, `700 76px ${SANS}`, palette.text);
    text(st.label, x, y + 54, `500 32px ${SANS}`, palette.textFaint);
  });

  // Footer.
  text('getgrain.fit', PAD, H - 96, `700 34px ${SANS}`, palette.text);
  text(
    'Calorie tracking that shows its work',
    W - PAD,
    H - 96,
    `500 28px ${SANS}`,
    palette.textFaint,
    'right',
  );

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('no image'))),
      'image/png',
    ),
  );
}

/** Opens the share sheet with the image; downloads it where sharing files
 *  isn't supported (most desktop browsers). Must run inside a tap. */
export async function shareWeekCard(blob: Blob, name: string): Promise<void> {
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
    } catch {
      // Closing the share sheet rejects; nothing to do.
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Canvas only uses a web font once it has loaded; wait for the ones we draw. */
async function loadFonts(): Promise<void> {
  if (!document.fonts?.load) return;
  await Promise.all(
    [`800 200px ${DOTS}`, `700 76px ${SANS}`, `500 32px ${SANS}`].map((f) =>
      document.fonts.load(f).catch(() => []),
    ),
  );
}

/** Letter spaced text, drawn a glyph at a time (canvas letterSpacing is not
 *  supported everywhere yet). */
function tracked(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  font: string,
  color: string,
  spacing: number,
) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  let at = x;
  for (const ch of s) {
    ctx.fillText(ch, at, y);
    at += ctx.measureText(ch).width + spacing;
  }
}

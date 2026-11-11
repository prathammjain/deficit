/**
 * charts.tsx — tiny, bespoke SVG charts tuned for the warm-instrument
 * dashboard: thin ink lines on faint hairlines, the single accent for the
 * "eaten" series, orange only where attention is due (surplus bars).
 *
 * Deliberately not a charting library: a `LineChart` (area + line + optional
 * target line, with gaps for unlogged days) and a signed `BarChart` (deficit
 * above the zero line, surplus below). Both measure their own width via
 * onLayout so they fill whatever card they sit in.
 */

import { useId, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { palette } from '@/constants/palette';

/**
 * ArcGauge — the reference's "48%" moment: a thin open arc sweeping with the
 * fraction, content (the number) centered inside. Gauge opens at the bottom.
 */
export function ArcGauge({
  fraction,
  size = 96,
  strokeWidth = 3,
  color = palette.accent,
  trackColor = palette.surface2,
  children,
}: {
  fraction: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  children?: ReactNode;
}) {
  const f = Math.max(0, Math.min(1, fraction));
  const START = 225; // degrees, 0 = top, clockwise — opens at the bottom
  const SWEEP = 270;
  const r = (size - strokeWidth) / 2;
  const c = size / 2;
  const polar = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: c + r * Math.cos(rad), y: c + r * Math.sin(rad) };
  };
  const arc = (from: number, to: number) => {
    const s = polar(from);
    const e = polar(to);
    const large = to - from > 180 ? 1 : 0;
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
  };
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* react-native-svg types its style prop narrower than RN's ViewStyle;
          the cast bridges the two for a plain absolute-fill. */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill as any}>
        <Path
          d={arc(START, START + SWEEP)}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />
        {f > 0 ? (
          <Path
            d={arc(START, START + SWEEP * f)}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}

/** Room on the right for the scale's labels. */
const GUTTER = 38;

/** Round steps (1, 2 or 5 times a power of ten) that cover min to max. */
export function niceTicks(min: number, max: number, count = 3): number[] {
  const raw = (max - min) / Math.max(1, count - 1) || Math.abs(max) || 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= raw) ?? 10 * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(+v.toFixed(6));
  return out;
}

/** Compact scale labels: 2,400 → 2.4k, 81.5 → 81.5. */
export const shortNumber = (v: number) =>
  Math.abs(v) >= 1000 ? `${+(v / 1000).toFixed(1)}k` : `${+v.toFixed(1)}`;

/** The first and last day under a chart. */
export function ChartDates({ from, to }: { from: string; to: string }) {
  const f = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  return (
    <View style={[styles.dates, { marginRight: GUTTER }]}>
      <Text style={styles.axisText}>{f(from)}</Text>
      <Text style={styles.axisText}>{f(to)}</Text>
    </View>
  );
}

export function LineChart({
  values,
  height = 150,
  color = palette.accent,
  target = null,
  showDots = false,
  scale = false,
}: {
  /** One value per day; null = no data that day (line breaks across gaps). */
  values: (number | null)[];
  height?: number;
  color?: string;
  /** Optional reference line, e.g. the calorie target. */
  target?: number | null;
  showDots?: boolean;
  /** Faint gridlines with their values on the right. */
  scale?: boolean;
}) {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const gid = `lc-${useId().replace(/:/g, '')}`;

  const nums = values.filter((v): v is number => v != null);
  const range = target != null ? [...nums, target] : nums;
  const min = range.length ? Math.min(...range) : 0;
  const max = range.length ? Math.max(...range) : 1;
  const pad = (max - min) * 0.14 || 1;
  const ticks = scale ? niceTicks(min, max) : [];
  const lo = scale ? ticks[0] : min - pad;
  const hi = scale ? ticks[ticks.length - 1] : max + pad;

  const n = values.length;
  const PADX = 5;
  const right = scale ? GUTTER : 0;
  const innerW = Math.max(0, w - PADX * 2 - right);
  const px = (i: number) =>
    PADX + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  // A little air above and below so the line never touches the edge.
  const AIR = scale ? 6 : 0;
  const py = (v: number) =>
    AIR + (height - AIR * 2) * (1 - (v - lo) / (hi - lo || 1));

  // Line as segments so it breaks across null (unlogged) days.
  const segments: string[] = [];
  let cur: string[] = [];
  values.forEach((v, i) => {
    if (v == null) {
      if (cur.length) segments.push(cur.join(' '));
      cur = [];
      return;
    }
    cur.push(
      `${cur.length ? 'L' : 'M'}${px(i).toFixed(1)} ${py(v).toFixed(1)}`,
    );
  });
  if (cur.length) segments.push(cur.join(' '));

  const firstIdx = values.findIndex((v) => v != null);
  const lastIdx =
    values.length - 1 - [...values].reverse().findIndex((v) => v != null);
  const areaPath =
    firstIdx >= 0 && w > 0
      ? `${values
          .map((v, i) =>
            v != null
              ? `${i === firstIdx ? 'M' : 'L'}${px(i).toFixed(1)} ${py(v).toFixed(1)}`
              : '',
          )
          .filter(Boolean)
          .join(
            ' ',
          )} L${px(lastIdx).toFixed(1)} ${height - AIR} L${px(firstIdx).toFixed(1)} ${height - AIR} Z`
      : '';

  return (
    <View onLayout={onLayout} style={{ height }}>
      {w > 0 ? (
        <Svg width={w} height={height}>
          <Defs>
            <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.14} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {ticks.map((v) => (
            <Line
              key={`g${v}`}
              x1={PADX}
              y1={py(v)}
              x2={w - right}
              y2={py(v)}
              stroke={palette.hairline}
              strokeWidth={1}
              strokeDasharray="2 4"
            />
          ))}
          {ticks.map((v) => (
            <SvgText
              key={`t${v}`}
              x={w}
              y={py(v) + 3.5}
              fontSize={10}
              fill={palette.textFaint}
              textAnchor="end"
            >
              {shortNumber(v)}
            </SvgText>
          ))}
          {areaPath ? <Path d={areaPath} fill={`url(#${gid})`} /> : null}
          {target != null ? (
            <Line
              x1={PADX}
              y1={py(target)}
              x2={w - PADX - right}
              y2={py(target)}
              stroke={palette.textDim}
              strokeWidth={1}
            />
          ) : null}
          {segments.map((d, i) => (
            <Path
              key={i}
              d={d}
              stroke={color}
              strokeWidth={2}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {showDots
            ? values.map((v, i) =>
                v != null ? (
                  <Circle key={i} cx={px(i)} cy={py(v)} r={3} fill={color} />
                ) : null,
              )
            : null}
        </Svg>
      ) : null}
    </View>
  );
}

export function BarChart({
  values,
  height = 130,
  positiveColor = palette.good,
  negativeColor = palette.danger,
  scale = false,
}: {
  /** Signed values; >= 0 drawn up from the zero line, < 0 drawn down. */
  values: number[];
  height?: number;
  positiveColor?: string;
  negativeColor?: string;
  /** A gridline at the top of the scale and labels on the right. */
  scale?: boolean;
}) {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  const ticks = scale
    ? niceTicks(Math.min(0, ...values), Math.max(1, ...values), 2)
    : [];
  const hi = scale ? Math.max(...ticks) : Math.max(0, ...values, 1);
  const lo = scale ? Math.min(...ticks) : Math.min(0, ...values);
  const span = hi - lo || 1;
  const py = (v: number) => height - ((v - lo) / span) * height;
  const zeroY = py(0);

  const n = Math.max(1, values.length);
  const gap = n > 45 ? 1 : 2;
  const right = scale ? GUTTER : 0;
  const plotW = Math.max(0, w - right);
  const bw = plotW > 0 ? Math.max(1, (plotW - gap * (n - 1)) / n) : 0;

  return (
    <View onLayout={onLayout} style={{ height }}>
      {w > 0 ? (
        <Svg width={w} height={height}>
          {ticks
            .filter((v) => v !== 0)
            .map((v) => (
              <Line
                key={`g${v}`}
                x1={0}
                y1={py(v)}
                x2={plotW}
                y2={py(v)}
                stroke={palette.hairline}
                strokeWidth={1}
                strokeDasharray="2 4"
              />
            ))}
          {ticks.map((v) => (
            <SvgText
              key={`t${v}`}
              x={w}
              y={Math.min(height - 1, Math.max(9, py(v) + 3.5))}
              fontSize={10}
              fill={palette.textFaint}
              textAnchor="end"
            >
              {shortNumber(v)}
            </SvgText>
          ))}
          <Line
            x1={0}
            y1={zeroY}
            x2={plotW}
            y2={zeroY}
            stroke={palette.hairline}
            strokeWidth={1}
          />
          {values.map((v, i) => {
            const top = Math.min(zeroY, py(v));
            const h = Math.max(1, Math.abs(zeroY - py(v)));
            return (
              <Rect
                key={i}
                x={i * (bw + gap)}
                y={top}
                width={bw}
                height={h}
                rx={Math.min(2, bw / 2)}
                fill={v >= 0 ? positiveColor : negativeColor}
                opacity={0.9}
              />
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dates: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  axisText: { fontSize: 10, color: palette.textFaint },
});

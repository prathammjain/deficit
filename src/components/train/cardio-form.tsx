/**
 * cardio-form.tsx: logging or editing one cardio session. Time, distance,
 * effort, heart rate; laps or intervals; incline, climb, indoor or out,
 * notes; and how hard it was overall, for training load.
 */

import { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Card, PrimaryButton } from '@/components/ui/primitives';
import { palette, radius, space } from '@/constants/palette';
import {
  clock,
  effortFromHr,
  EFFORTS,
  fastestLap,
  intervals,
  KINDS,
  kindOf,
  lapTotals,
  liveLaps,
  movingMs,
  paceText,
  ZONES,
  zoneOf,
  type CardioKind,
  type CardioLap,
  type CardioLive,
  type CardioSession,
  type Effort,
} from '@/lib/cardio/cardio';

import { Chip, DayStepper, NumField } from './bits';
import { SessionRpe } from './effort';
import { tr } from './styles';

const pad = (n: number) => String(n).padStart(2, '0');

/** A lap as typed: minutes and seconds, distance in the kind's unit. */
export interface LapDraft {
  m: number | null;
  s: number | null;
  dist: number | null;
  hr: number | null;
}

export interface Draft {
  id: string | null;
  kind: CardioKind;
  date: string;
  /** "07:30", or "" to count back from now. */
  time: string;
  h: number | null;
  m: number | null;
  s: number | null;
  /** In the kind's own unit: km, or metres. */
  dist: number | null;
  hr: number | null;
  effort: Effort;
  laps: LapDraft[];
  /** The laps are reps with rest between, not splits of one effort. */
  intervals: boolean;
  incline: number | null;
  elevation: number | null;
  indoor: boolean;
  note: string;
  rpe: number | null;
  /** Came from the live timer: saving clears it. */
  fromLive?: boolean;
}

export function blank(today: string, kind: CardioKind = 'run'): Draft {
  return {
    id: null,
    kind,
    date: today,
    time: '',
    h: null,
    m: null,
    s: null,
    dist: null,
    hr: null,
    effort: 'moderate',
    laps: [],
    intervals: false,
    incline: null,
    elevation: null,
    indoor: false,
    note: '',
    rpe: null,
  };
}

const toDist = (km: number | null | undefined, kind: CardioKind) =>
  km ? (kindOf(kind).unit === 'm' ? Math.round(km * 1000) : km) : null;

const fromDist = (d: number | null, kind: CardioKind) =>
  d ? (kindOf(kind).unit === 'm' ? d / 1000 : d) : null;

function splitMs(ms: number) {
  const secs = Math.round(ms / 1000);
  return {
    h: Math.floor(secs / 3600) || null,
    m: Math.floor((secs % 3600) / 60) || null,
    s: secs % 60 || null,
  };
}

function lapDraft(l: CardioLap, kind: CardioKind): LapDraft {
  const secs = Math.round(l.ms / 1000);
  return {
    m: Math.floor(secs / 60) || null,
    s: secs % 60 || null,
    dist: toDist(l.km, kind),
    hr: l.hr ?? null,
  };
}

export function fromSession(c: CardioSession): Draft {
  const d = new Date(c.startedAt);
  return {
    id: c.id,
    kind: c.kind,
    date: c.date,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    ...splitMs(c.ms),
    dist: toDist(c.km, c.kind),
    hr: c.avgHr ?? null,
    effort: c.effort,
    laps: (c.laps ?? []).map((l) => lapDraft(l, c.kind)),
    intervals: !!c.intervals,
    incline: c.incline ?? null,
    elevation: c.elevation ?? null,
    indoor: !!c.indoor,
    note: c.note ?? '',
    rpe: c.rpe ?? null,
  };
}

/** A finished live session, ready to check and save. */
export function fromLive(l: CardioLive, today: string): Draft {
  const ms = movingMs(l);
  const laps = l.laps.length ? liveLaps(l, ms) : [];
  const km = laps.length ? lapTotals(laps).km : null;
  const d = new Date(l.startedAt);
  return {
    ...blank(today, l.kind),
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    ...splitMs(ms),
    dist: toDist(km, l.kind),
    laps: laps.map((x) => lapDraft(x, l.kind)),
    fromLive: true,
  };
}

const lapMs = (l: LapDraft) => ((l.m ?? 0) * 60 + (l.s ?? 0)) * 1000;

export const draftMs = (d: Draft) => {
  const typed = ((d.h ?? 0) * 3600 + (d.m ?? 0) * 60 + (d.s ?? 0)) * 1000;
  return typed || d.laps.reduce((t, l) => t + lapMs(l), 0);
};

/** Laps as stored; laps with no time are dropped. */
export function draftLaps(d: Draft): CardioLap[] {
  return d.laps
    .filter((l) => lapMs(l) > 0)
    .map((l) => ({
      ms: lapMs(l),
      km: fromDist(l.dist, d.kind),
      ...(l.hr ? { hr: l.hr } : {}),
    }));
}

/** The distance: typed, or the laps added up. */
export function draftKm(d: Draft): number | null {
  if (!kindOf(d.kind).unit) return null;
  return fromDist(d.dist, d.kind) ?? lapTotals(draftLaps(d)).km;
}

/** When it started: the typed time, or counted back from now for today. */
export function draftStart(d: Draft, today: string, ms: number): number {
  const [y, mo, day] = d.date.split('-').map(Number);
  const t = /^(\d{1,2}):(\d{2})$/.exec(d.time.trim());
  if (t) return new Date(y, mo - 1, day, Number(t[1]), Number(t[2])).getTime();
  if (d.date === today) return Date.now() - ms;
  return new Date(y, mo - 1, day, 12, 0).getTime();
}

export function SessionForm({
  draft,
  today,
  maxHr,
  error,
  busy,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: {
  draft: Draft;
  today: string;
  /** For the zone a heart rate falls in; null without an age. */
  maxHr: number | null;
  error: string | null;
  busy: boolean;
  onChange: (d: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const def = kindOf(draft.kind);
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  const effort = EFFORTS.find((e) => e.id === draft.effort);
  const [showLaps, setShowLaps] = useState(draft.laps.length > 0);
  const [more, setMore] = useState(
    !!(draft.incline || draft.elevation || draft.indoor || draft.note),
  );
  const [reps, setReps] = useState<number | null>(null);
  const [repDist, setRepDist] = useState<number | null>(null);
  const unitWord = def.unit === 'm' ? 'm' : 'km';
  const hrZone = draft.hr && maxHr ? zoneOf(draft.hr, maxHr) : null;
  const hrEffort = draft.hr && maxHr ? effortFromHr(draft.hr, maxHr) : null;
  const laps = draftLaps(draft);
  const fast = fastestLap(laps);
  const setLap = (i: number, patch: Partial<LapDraft>) =>
    set({ laps: draft.laps.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  return (
    <Card style={fs.top}>
      <Text style={tr.strong}>{draft.id ? 'Edit session' : 'Log cardio'}</Text>

      <View style={[tr.chips, fs.field]}>
        {KINDS.map((k) => (
          <Chip
            key={k.id}
            label={k.label}
            on={k.id === draft.kind}
            onPress={() =>
              set({
                kind: k.id,
                // A distance typed in km means nothing in metres.
                ...(kindOf(k.id).unit === def.unit
                  ? {}
                  : {
                      dist: null,
                      laps: draft.laps.map((l) => ({ ...l, dist: null })),
                    }),
              })
            }
          />
        ))}
      </View>

      <View style={fs.field}>
        <DayStepper
          value={draft.date}
          today={today}
          onChange={(date) => set({ date })}
        />
      </View>

      <Text style={[tr.label, fs.field]}>TIME</Text>
      <View style={fs.inline}>
        {(['h', 'm', 's'] as const).map((k) => (
          <NumField
            key={k}
            value={draft[k]}
            placeholder={k === 'm' ? 'min' : k}
            label={k === 'h' ? 'Hours' : k === 'm' ? 'Minutes' : 'Seconds'}
            maxLength={2}
            style={[tr.input, fs.box]}
            onChange={(v) => set({ [k]: v })}
          />
        ))}
      </View>

      {def.unit ? (
        <>
          <Text style={[tr.label, fs.field]}>
            DISTANCE, {def.unit === 'm' ? 'METRES' : 'KM'}
          </Text>
          <NumField
            value={draft.dist}
            placeholder={
              laps.length && lapTotals(laps).km
                ? String(toDist(lapTotals(laps).km, draft.kind))
                : def.unit === 'm'
                  ? '2000'
                  : '5.0'
            }
            label={`Distance in ${def.unit === 'm' ? 'metres' : 'km'}`}
            decimal={def.unit === 'km'}
            maxLength={6}
            style={tr.input}
            onChange={(dist) => set({ dist })}
          />
        </>
      ) : null}

      <Text style={[tr.label, fs.field]}>EFFORT</Text>
      <View style={tr.chips}>
        {EFFORTS.map((e) => (
          <Chip
            key={e.id}
            label={e.label}
            on={e.id === draft.effort}
            onPress={() => set({ effort: e.id })}
          />
        ))}
      </View>
      {effort ? <Text style={[tr.faint, fs.under]}>{effort.hint}</Text> : null}

      <View style={[fs.inline, fs.field]}>
        <View style={fs.half}>
          <Text style={tr.label}>AVG HEART RATE</Text>
          <NumField
            value={draft.hr}
            placeholder="Optional"
            label="Average heart rate"
            style={[tr.input, fs.gap]}
            onChange={(hr) => set({ hr })}
          />
        </View>
        <View style={fs.half}>
          <Text style={tr.label}>STARTED AT</Text>
          <TimeField value={draft.time} onChange={(time) => set({ time })} />
        </View>
      </View>
      {hrZone && hrEffort ? (
        <View style={[fs.inlineWrap, fs.under]}>
          <Text style={tr.faint}>
            Zone {hrZone}, {ZONES[hrZone - 1].label.toLowerCase()} by heart
            rate.
          </Text>
          {hrEffort !== draft.effort ? (
            <Pressable onPress={() => set({ effort: hrEffort })} hitSlop={6}>
              <Text style={[tr.linkText, tr.accentText]}>Use {hrEffort}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {!draft.time && draft.date === today && !draft.fromLive ? (
        <Text style={[tr.faint, fs.under]}>
          Leave the start empty if you just finished: Grain counts back from
          now.
        </Text>
      ) : null}

      {/* Laps and intervals */}
      {showLaps ? (
        <View style={fs.section}>
          <Text style={tr.label}>LAPS OR INTERVALS</Text>
          {draft.laps.length === 0 ? (
            <View style={[fs.inline, fs.gapTop]}>
              <NumField
                value={reps}
                placeholder="6"
                label="How many"
                maxLength={2}
                style={[tr.input, fs.box]}
                onChange={setReps}
              />
              <Text style={[tr.muted, fs.times]}>×</Text>
              <NumField
                value={repDist}
                placeholder={def.unit === 'm' ? '500' : '0.8'}
                label={`Each, in ${unitWord}`}
                decimal={def.unit === 'km'}
                maxLength={5}
                style={[tr.input, fs.box]}
                onChange={setRepDist}
              />
              <Pressable
                onPress={() => {
                  if (!reps) return;
                  set({
                    intervals: true,
                    laps: intervals(reps, null).map(() => ({
                      m: null,
                      s: null,
                      dist: repDist,
                      hr: null,
                    })),
                  });
                }}
                disabled={!reps}
                style={({ pressed }) => [
                  fs.makeBtn,
                  !reps && tr.disabled,
                  pressed && tr.pressed,
                ]}
              >
                <Text style={fs.makeText}>Make</Text>
              </Pressable>
            </View>
          ) : null}
          {draft.laps.length === 0 ? (
            <Text style={[tr.faint, fs.under]}>
              Say 6 × 800 m, then fill in each time. Or add laps one at a time.
            </Text>
          ) : (
            <View style={fs.lapHead}>
              <Text style={[fs.lapCol, fs.lapN]}>#</Text>
              <Text style={[fs.lapCol, fs.lapTime]}>TIME</Text>
              {def.unit ? (
                <Text style={[fs.lapCol, fs.lapDist]}>
                  {unitWord.toUpperCase()}
                </Text>
              ) : null}
              <Text style={[fs.lapCol, fs.lapHr]}>HR</Text>
              <Text style={[fs.lapCol, fs.lapPace]}>PACE</Text>
            </View>
          )}
          {draft.laps.map((l, i) => {
            const ms = lapMs(l);
            const km = fromDist(l.dist, draft.kind);
            const stored = laps.findIndex((x) => x === laps[i]);
            return (
              <View key={i} style={fs.lapRow}>
                <Text style={[fs.lapNum, fs.lapN]}>{i + 1}</Text>
                <View style={[fs.lapTime, fs.inlineTight]}>
                  <NumField
                    value={l.m}
                    placeholder="m"
                    label={`Lap ${i + 1} minutes`}
                    maxLength={3}
                    style={[tr.input, fs.lapBox]}
                    onChange={(m) => setLap(i, { m })}
                  />
                  <NumField
                    value={l.s}
                    placeholder="s"
                    label={`Lap ${i + 1} seconds`}
                    maxLength={2}
                    style={[tr.input, fs.lapBox]}
                    onChange={(s) => setLap(i, { s })}
                  />
                </View>
                {def.unit ? (
                  <NumField
                    value={l.dist}
                    placeholder={unitWord}
                    label={`Lap ${i + 1} distance`}
                    decimal={def.unit === 'km'}
                    maxLength={5}
                    style={[tr.input, fs.lapBox, fs.lapDist]}
                    onChange={(dist) => setLap(i, { dist })}
                  />
                ) : null}
                <NumField
                  value={l.hr}
                  placeholder="hr"
                  label={`Lap ${i + 1} heart rate`}
                  style={[tr.input, fs.lapBox, fs.lapHr]}
                  onChange={(hr) => setLap(i, { hr })}
                />
                <Text
                  style={[
                    fs.lapPace,
                    fs.lapPaceText,
                    stored >= 0 && fast === i && fs.fast,
                  ]}
                  numberOfLines={1}
                >
                  {ms && km ? paceText(ms / km, draft.kind) : ''}
                </Text>
                <Pressable
                  onPress={() =>
                    set({ laps: draft.laps.filter((_, j) => j !== i) })
                  }
                  hitSlop={6}
                  accessibilityLabel={`Remove lap ${i + 1}`}
                  style={fs.lapX}
                >
                  <Text style={tr.faint}>✕</Text>
                </Pressable>
              </View>
            );
          })}
          <Pressable
            onPress={() =>
              set({
                laps: [
                  ...draft.laps,
                  {
                    m: null,
                    s: null,
                    dist: draft.laps[draft.laps.length - 1]?.dist ?? null,
                    hr: null,
                  },
                ],
              })
            }
            style={({ pressed }) => [fs.addLap, pressed && tr.pressed]}
          >
            <Text style={tr.linkText}>Add a lap</Text>
          </Pressable>
          {draft.laps.length ? (
            <View style={[tr.chips, fs.gapTop]}>
              <Chip
                label="Reps with rest between"
                on={draft.intervals}
                onPress={() => set({ intervals: true })}
              />
              <Chip
                label="Splits of one effort"
                on={!draft.intervals}
                onPress={() => set({ intervals: false })}
              />
            </View>
          ) : null}
          {laps.length ? (
            <Text style={[tr.faint, fs.under]}>
              {laps.length} {laps.length === 1 ? 'lap' : 'laps'},{' '}
              {clock(lapTotals(laps).ms)}
              {fast != null ? `. Fastest is lap ${fast + 1}.` : '.'} Empty time
              boxes take the laps added up.
            </Text>
          ) : null}
        </View>
      ) : (
        <Pressable
          onPress={() => setShowLaps(true)}
          hitSlop={6}
          style={fs.reveal}
        >
          <Text style={[tr.linkText, tr.accentText]}>
            Add laps or intervals
          </Text>
        </Pressable>
      )}

      {more ? (
        <View style={fs.section}>
          <View style={tr.chips}>
            <Chip
              label="Outdoors"
              on={!draft.indoor}
              onPress={() => set({ indoor: false })}
            />
            <Chip
              label="Indoors"
              on={draft.indoor}
              onPress={() => set({ indoor: true })}
            />
          </View>
          <View style={[fs.inline, fs.field]}>
            <View style={fs.half}>
              <Text style={tr.label}>INCLINE, %</Text>
              <NumField
                value={draft.incline}
                placeholder="Treadmill"
                label="Incline in percent"
                decimal
                maxLength={4}
                style={[tr.input, fs.gap]}
                onChange={(incline) => set({ incline })}
              />
            </View>
            <View style={fs.half}>
              <Text style={tr.label}>CLIMB, M</Text>
              <NumField
                value={draft.elevation}
                placeholder="Elevation"
                label="Climb in metres"
                maxLength={5}
                style={[tr.input, fs.gap]}
                onChange={(elevation) => set({ elevation })}
              />
            </View>
          </View>
          <TextInput
            value={draft.note}
            onChangeText={(note) => set({ note })}
            placeholder="Notes: route, shoes, how it felt"
            placeholderTextColor={palette.textFaint}
            multiline
            style={[tr.input, fs.note]}
          />
        </View>
      ) : (
        <Pressable onPress={() => setMore(true)} hitSlop={6} style={fs.reveal}>
          <Text style={[tr.linkText, tr.accentText]}>
            Add incline, climb, indoors or notes
          </Text>
        </Pressable>
      )}

      <View style={fs.section}>
        <SessionRpe value={draft.rpe} onChange={(rpe) => set({ rpe })} />
      </View>

      {error ? <Text style={[fs.error, fs.field]}>{error}</Text> : null}

      <View style={[fs.actions, fs.field]}>
        <PrimaryButton
          label={draft.id ? 'Save changes' : 'Save'}
          onPress={onSave}
          disabled={busy || draftMs(draft) <= 0}
          style={tr.flex1}
        />
        <Pressable onPress={onCancel} hitSlop={8}>
          <Text style={tr.linkText}>Cancel</Text>
        </Pressable>
      </View>
      {onDelete ? (
        <Pressable onPress={onDelete} hitSlop={8} style={fs.delete}>
          <Text style={[tr.linkText, fs.danger]}>Delete session</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

/** The browser's own time picker on the web; typed "07:30" elsewhere. */
function TimeField({
  value,
  onChange,
}: {
  value: string;
  onChange: (time: string) => void;
}) {
  if (Platform.OS === 'web') {
    return (
      <input
        type="time"
        value={value}
        aria-label="Started at"
        onChange={(e) => onChange(e.target.value)}
        style={{
          marginTop: space.sm,
          padding: space.md,
          borderRadius: radius.sm,
          border: 'none',
          background: palette.surface2,
          color: palette.text,
          fontSize: 15,
          fontFamily: 'inherit',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
    );
  }
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="07:30"
      placeholderTextColor={palette.textFaint}
      maxLength={5}
      style={[tr.input, fs.gap]}
    />
  );
}

const fs = StyleSheet.create({
  top: { marginTop: space.lg },
  field: { marginTop: space.md },
  under: { marginTop: space.sm },
  gapTop: { marginTop: space.sm },
  inline: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  inlineWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
  },
  inlineTight: { flexDirection: 'row', gap: 4 },
  // flexBasis 0 and minWidth 0 let boxes shrink to share a row.
  box: { flex: 1, flexBasis: 0, minWidth: 0, textAlign: 'center' },
  half: { flex: 1, flexBasis: 0, minWidth: 0 },
  gap: { marginTop: space.sm, width: '100%', minWidth: 0 },
  times: { alignSelf: 'center' },
  makeBtn: {
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: palette.text,
  },
  makeText: { color: palette.surface, fontWeight: '700' },
  section: {
    marginTop: space.lg,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: palette.hairline,
  },
  reveal: { alignSelf: 'flex-start', marginTop: space.md },
  lapHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: space.sm,
  },
  lapCol: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: palette.textFaint,
  },
  lapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  lapN: { width: 18 },
  lapNum: { fontSize: 13, fontWeight: '700', color: palette.textMuted },
  lapTime: { flex: 2, flexBasis: 0, minWidth: 0 },
  lapDist: { flex: 1.2, flexBasis: 0, minWidth: 0 },
  lapHr: { flex: 1, flexBasis: 0, minWidth: 0 },
  lapPace: { flex: 1.6, flexBasis: 0, minWidth: 0 },
  lapPaceText: { fontSize: 12, color: palette.textMuted, textAlign: 'right' },
  fast: { color: palette.accent, fontWeight: '700' },
  lapBox: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  lapX: { width: 18, alignItems: 'center' },
  addLap: { alignSelf: 'flex-start', paddingVertical: space.sm },
  note: { marginTop: space.md, minHeight: 64, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  delete: { alignSelf: 'center', marginTop: space.lg },
  danger: { color: palette.danger },
  error: { color: palette.danger, fontSize: 14 },
});

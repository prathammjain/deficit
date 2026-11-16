/**
 * cardio.tsx: the Cardio tab. Log a run, ride, row, swim or anything else;
 * see this week's minutes against the WHO guideline, pace over time, and
 * best times that carry across breaks, like lifts and HYROX.
 *
 * No calories anywhere: cardio is already in the burn the weekly check in
 * measures, so it never raises the food target (see lib/cardio/cardio.ts).
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

import { BarChart, LineChart } from '@/components/charts';
import {
  Card,
  Hairline,
  PrimaryButton,
  ProgressBar,
  SectionLabel,
} from '@/components/ui/primitives';
import { palette, radius, space, type as typo } from '@/constants/palette';
import {
  checkSession,
  clock,
  distanceText,
  EFFORTS,
  kindOf,
  kindRecords,
  kindsDone,
  KINDS,
  markName,
  minutes,
  msPerKm,
  nearLifting,
  paceText,
  paceTrend,
  sessionPace,
  strengthDays,
  WHO_MIN,
  WHO_STRENGTH_DAYS,
  WHO_UPPER,
  type CardioKind,
  type CardioSession,
  type Effort,
} from '@/lib/cardio/cardio';
import {
  deleteCardio,
  loadCardioSettings,
  markNearTipSeen,
  newCardio,
  saveCardio,
} from '@/lib/cardio/store';
import { shortDate } from '@/lib/date';
import { periodOf, periodTick, shiftPeriod } from '@/lib/train/progress';

import { Chip, DayStepper, NumField } from './bits';
import type { Training } from './data';
import { tr } from './styles';

const MIN = 60_000;

interface Draft {
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
}

const pad = (n: number) => String(n).padStart(2, '0');

function blank(today: string, kind: CardioKind = 'run'): Draft {
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
  };
}

function fromSession(c: CardioSession): Draft {
  const d = new Date(c.startedAt);
  const secs = Math.round(c.ms / 1000);
  const unit = kindOf(c.kind).unit;
  return {
    id: c.id,
    kind: c.kind,
    date: c.date,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    h: Math.floor(secs / 3600) || null,
    m: Math.floor((secs % 3600) / 60) || null,
    s: secs % 60 || null,
    dist: c.km ? (unit === 'm' ? Math.round(c.km * 1000) : c.km) : null,
    hr: c.avgHr ?? null,
    effort: c.effort,
  };
}

const draftMs = (d: Draft) =>
  ((d.h ?? 0) * 3600 + (d.m ?? 0) * 60 + (d.s ?? 0)) * 1000;

/** When it started: the typed time, or counted back from now for today. */
function draftStart(d: Draft, today: string, ms: number): number {
  const [y, mo, day] = d.date.split('-').map(Number);
  const t = /^(\d{1,2}):(\d{2})$/.exec(d.time.trim());
  if (t) return new Date(y, mo - 1, day, Number(t[1]), Number(t[2])).getTime();
  if (d.date === today) return Date.now() - ms;
  return new Date(y, mo - 1, day, 12, 0).getTime();
}

/** "0:12 faster" or "1.4 km/h faster", against an earlier pace. */
function paceChange(kind: CardioKind, now: number, then: number): string {
  if (kindOf(kind).pace === 'kmh') {
    const d = 3_600_000 / now - 3_600_000 / then;
    if (Math.abs(d) < 0.05) return 'the same speed';
    return `${Math.abs(d).toFixed(1)} km/h ${d > 0 ? 'faster' : 'slower'}`;
  }
  const div =
    kindOf(kind).pace === 'per500'
      ? 2
      : kindOf(kind).pace === 'per100'
        ? 10
        : 1;
  const d = (now - then) / div;
  if (Math.abs(d) < 1000) return 'the same pace';
  return `${clock(Math.abs(d))} ${d < 0 ? 'faster' : 'slower'}`;
}

/** A pace in the chart's unit: minutes per unit, or km/h for rides. */
function chartValue(kind: CardioKind, perKm: number): number {
  switch (kindOf(kind).pace) {
    case 'kmh':
      return 3_600_000 / perKm;
    case 'per500':
      return perKm / 2 / MIN;
    case 'per100':
      return perKm / 10 / MIN;
    default:
      return perKm / MIN;
  }
}

export function CardioView({
  data,
  today,
  editId,
  editStamp,
  onChanged,
}: {
  data: Training;
  today: string;
  /** Open this session in the form (from a tap in the history). */
  editId?: string;
  /** Changes on each arrival, so the same session can be opened again. */
  editStamp?: string;
  onChanged: (cardio: CardioSession[]) => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tip, setTip] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<CardioKind | null>(null);

  // Arriving from the history opens that session. Adjusted during render so
  // there is no flash of the closed form.
  const [seenStamp, setSeenStamp] = useState<string | undefined>(undefined);
  if (editStamp !== seenStamp) {
    setSeenStamp(editStamp);
    const found = editId ? data.cardio.find((c) => c.id === editId) : null;
    if (found) {
      setDraft(fromSession(found));
      setError(null);
    }
  }

  const save = async () => {
    if (!draft) return;
    const ms = draftMs(draft);
    const def = kindOf(draft.kind);
    const km =
      def.unit && draft.dist
        ? def.unit === 'm'
          ? draft.dist / 1000
          : draft.dist
        : null;
    const problem = checkSession({ kind: draft.kind, ms, km, avgHr: draft.hr });
    if (problem) {
      setError(problem);
      return;
    }
    const startedAt = draftStart(draft, today, ms);
    const session = newCardio(
      {
        kind: draft.kind,
        startedAt,
        ms,
        km,
        avgHr: draft.hr,
        effort: draft.effort,
      },
      draft.id ?? undefined,
    );
    setBusy(true);
    try {
      const all = await saveCardio(session);
      onChanged([...all].reverse());
      setDraft(null);
      setError(null);
      setNotice(
        `${draft.id ? 'Updated' : 'Saved'} ${def.label.toLowerCase()}, ${clock(ms)}${km ? `, ${distanceText(km, draft.kind)}` : ''}.`,
      );
      if (nearLifting(session, data.workouts)) {
        const settings = await loadCardioSettings().catch(() => ({
          nearTipSeen: true,
        }));
        if (!settings.nearTipSeen) {
          setTip(true);
          void markNearTipSeen().catch(() => undefined);
        }
      }
    } catch {
      setError('Couldn’t save. Try again.');
    }
    setBusy(false);
  };

  const remove = async () => {
    if (!draft?.id) return;
    setBusy(true);
    try {
      const all = await deleteCardio(draft.id);
      onChanged([...all].reverse());
      setDraft(null);
      setNotice('Session deleted.');
    } catch {
      setError('Couldn’t delete. Try again.');
    }
    setBusy(false);
  };

  // This week and the weeks before
  const week = periodOf('week', today);
  const mins = minutes(data.cardio, data.sims, week);
  const lifts = strengthDays(data.workouts, week);
  const weeks = Array.from({ length: 8 }, (_, i) => shiftPeriod(week, i - 7));
  const weekly = weeks.map(
    (p) => minutes(data.cardio, data.sims, p).equivalent,
  );

  // Progress for one kind
  const kinds = kindsDone(data.cardio);
  const kind = picked && kinds.includes(picked) ? picked : kinds[0];
  const trend = kind ? paceTrend(data.cardio, kind, today) : null;
  const rec = kind ? kindRecords(data.cardio, kind) : null;
  const recent = [...data.cardio].reverse().slice(0, 5);

  return (
    <View>
      {draft ? (
        <SessionForm
          draft={draft}
          today={today}
          error={error}
          busy={busy}
          onChange={(d) => {
            setDraft(d);
            setError(null);
          }}
          onSave={() => void save()}
          onCancel={() => {
            setDraft(null);
            setError(null);
          }}
          onDelete={draft.id ? () => void remove() : undefined}
        />
      ) : (
        <Card style={cs.top}>
          <Text style={tr.muted}>
            Runs, rides, rows, swims and the rest. Grain tracks time, distance
            and pace, and keeps your best times for good.
          </Text>
          <PrimaryButton
            label="Log cardio"
            onPress={() => {
              setNotice(null);
              setTip(false);
              setDraft(blank(today, kinds[0] ?? 'run'));
            }}
            style={cs.button}
          />
          {notice ? <Text style={[tr.faint, cs.notice]}>{notice}</Text> : null}
        </Card>
      )}

      {tip ? (
        <Card style={cs.tip}>
          <Text style={tr.strong}>Lifting and cardio close together</Text>
          <Text style={[tr.muted, cs.tipBody]}>
            This was within 3 hours of a workout. A review of 43 studies found
            that doing both doesn’t hold back muscle size or strength, but can
            hold back gains in power, mostly when they’re in the same session.
            Leaving 3 hours or more between them avoided that.
          </Text>
          <Text style={[tr.faint, cs.tipBody]}>
            Schumann and others, Sports Medicine, 2022
          </Text>
          <Pressable
            onPress={() => setTip(false)}
            hitSlop={8}
            style={cs.tipClose}
          >
            <Text style={tr.linkText}>Got it</Text>
          </Pressable>
        </Card>
      ) : null}

      <SectionLabel>This week</SectionLabel>
      <Card>
        <View style={cs.weekHead}>
          <Text style={cs.big}>{mins.equivalent}</Text>
          <Text style={tr.muted}>
            minutes, against the {WHO_MIN} to {WHO_UPPER} a week the WHO
            suggests
          </Text>
        </View>
        <View style={cs.bar}>
          <ProgressBar
            fraction={mins.equivalent / WHO_MIN}
            fillColor={
              mins.equivalent >= WHO_MIN ? palette.text : palette.accent
            }
          />
        </View>
        <Text style={[tr.faint, cs.under]}>
          {mins.moderate} moderate · {mins.vigorous} vigorous, which count
          double{mins.light ? ` · ${mins.light} light, not counted` : ''}. HYROX
          sims count as vigorous.
        </Text>
        <Hairline style={cs.hair} />
        <View style={cs.rowBetween}>
          <Text style={tr.strong}>Strength days</Text>
          <Text style={[tr.strong, tr.num]}>
            {lifts} of {WHO_STRENGTH_DAYS}
          </Text>
        </View>
        <Text style={[tr.faint, cs.under]}>
          The WHO also suggests muscle strengthening on 2 or more days a week.
        </Text>
      </Card>

      <SectionLabel>Minutes by week</SectionLabel>
      <Card>
        <BarChart values={weekly} height={80} positiveColor={palette.text} />
        <View style={tr.barLabels}>
          <Text style={tr.faint}>{periodTick(weeks[0])}</Text>
          <Text style={[tr.faint, { color: palette.text }]}>
            {periodTick(weeks[weeks.length - 1])}
          </Text>
        </View>
        <Text style={[tr.faint, cs.under]}>
          Cardio and HYROX, with vigorous minutes counted double.
        </Text>
      </Card>

      {kind && rec ? (
        <>
          <SectionLabel>Progress</SectionLabel>
          {kinds.length > 1 ? (
            <View style={[tr.chips, cs.chips]}>
              {kinds.map((k) => (
                <Chip
                  key={k}
                  label={kindOf(k).label}
                  on={k === kind}
                  onPress={() => setPicked(k)}
                />
              ))}
            </View>
          ) : null}
          <Card>
            {trend ? (
              <>
                <Text style={cs.big}>
                  {paceText(
                    trend.recentMsPerKm ?? trend.paces[trend.paces.length - 1],
                    kind,
                  )}
                </Text>
                <Text style={tr.muted}>
                  {trend.recentMsPerKm != null
                    ? `Your ${kindOf(kind).label.toLowerCase()} pace over the last 4 weeks, ${trend.recentCount} ${trend.recentCount === 1 ? 'session' : 'sessions'}`
                    : 'Your latest pace. Nothing in the last 4 weeks.'}
                </Text>
                {trend.paces.length > 1 ? (
                  <View style={cs.chart}>
                    <LineChart
                      values={trend.paces
                        .slice(-20)
                        .map((p) => chartValue(kind, p))}
                      height={110}
                      showDots
                    />
                  </View>
                ) : null}
                <Text style={[tr.faint, cs.under]}>
                  {kindOf(kind).pace === 'kmh'
                    ? 'Higher is faster.'
                    : 'Lower is faster.'}{' '}
                  Each dot is one session.
                </Text>
                {trend.recentMsPerKm != null && trend.beforeMsPerKm != null ? (
                  <Text style={cs.note}>
                    {cap(
                      paceChange(
                        kind,
                        trend.recentMsPerKm,
                        trend.beforeMsPerKm,
                      ),
                    )}{' '}
                    than the 4 weeks before.
                  </Text>
                ) : null}
                {trend.paces.length > 1 ? (
                  <Text style={cs.note}>
                    {cap(
                      paceChange(
                        kind,
                        trend.recentMsPerKm ??
                          trend.paces[trend.paces.length - 1],
                        trend.firstMsPerKm,
                      ),
                    )}{' '}
                    than your first, over {trend.paces.length} sessions.
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={tr.body}>
                {rec.count}{' '}
                {rec.count === 1
                  ? kindOf(kind).label.toLowerCase()
                  : kindOf(kind).plural}{' '}
                so far. Add a distance next time to see your pace.
              </Text>
            )}
          </Card>

          <SectionLabel>Records</SectionLabel>
          <Card>
            {rec.marks.map((m) => (
              <Row
                key={m.km}
                name={`Best ${markName(m.km, kind)}`}
                value={clock(m.best.ms)}
                sub={shortDate(m.best.date)}
              />
            ))}
            {rec.longestKm ? (
              <Row
                name="Longest distance"
                value={distanceText(rec.longestKm.km, kind)}
                sub={shortDate(rec.longestKm.date)}
              />
            ) : null}
            {rec.longestMs ? (
              <Row
                name="Longest session"
                value={clock(rec.longestMs.ms)}
                sub={shortDate(rec.longestMs.date)}
              />
            ) : null}
            <Text style={[tr.faint, cs.under]}>
              Best times count sessions that covered the distance and no more
              than 5% extra. They stay through breaks.
            </Text>
          </Card>

          <SectionLabel>Recent</SectionLabel>
          <Card padded={false}>
            {recent.map((c, i) => (
              <Pressable
                key={c.id}
                onPress={() => {
                  setDraft(fromSession(c));
                  setError(null);
                }}
                style={({ pressed }) => [
                  tr.histRow,
                  i === 0 && { borderTopWidth: 0 },
                  pressed && tr.pressed,
                ]}
              >
                <View style={tr.histTop}>
                  <Text style={tr.histName} numberOfLines={1}>
                    {kindOf(c.kind).label}
                    {c.km ? ` · ${distanceText(c.km, c.kind)}` : ''}
                  </Text>
                  <Text style={tr.histDate}>{shortDate(c.date)}</Text>
                </View>
                <Text style={tr.histStat}>
                  {clock(c.ms)}
                  {msPerKm(c) ? ` · ${sessionPace(c)}` : ''}
                  {c.avgHr ? ` · ${c.avgHr} bpm` : ''}
                </Text>
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}

      <Text style={[tr.faint, cs.footer]}>
        Cardio doesn’t add calories to your target. Your weekly check in already
        counts it in what you really burn, so adding it again would count it
        twice.
      </Text>
    </View>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function SessionForm({
  draft,
  today,
  error,
  busy,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: {
  draft: Draft;
  today: string;
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
  return (
    <Card style={cs.top}>
      <Text style={tr.strong}>{draft.id ? 'Edit session' : 'Log cardio'}</Text>

      <View style={[tr.chips, cs.field]}>
        {KINDS.map((k) => (
          <Chip
            key={k.id}
            label={k.label}
            on={k.id === draft.kind}
            onPress={() =>
              set({
                kind: k.id,
                // A distance typed in km means nothing in metres.
                dist: kindOf(k.id).unit === def.unit ? draft.dist : null,
              })
            }
          />
        ))}
      </View>

      <View style={cs.field}>
        <DayStepper
          value={draft.date}
          today={today}
          onChange={(date) => set({ date })}
        />
      </View>

      <Text style={[tr.label, cs.field]}>TIME</Text>
      <View style={cs.inline}>
        <NumField
          value={draft.h}
          placeholder="h"
          label="Hours"
          maxLength={2}
          style={[tr.input, cs.box]}
          onChange={(h) => set({ h })}
        />
        <NumField
          value={draft.m}
          placeholder="min"
          label="Minutes"
          maxLength={2}
          style={[tr.input, cs.box]}
          onChange={(m) => set({ m })}
        />
        <NumField
          value={draft.s}
          placeholder="s"
          label="Seconds"
          maxLength={2}
          style={[tr.input, cs.box]}
          onChange={(s) => set({ s })}
        />
      </View>

      {def.unit ? (
        <>
          <Text style={[tr.label, cs.field]}>
            DISTANCE, {def.unit === 'm' ? 'METRES' : 'KM'}
          </Text>
          <NumField
            value={draft.dist}
            placeholder={def.unit === 'm' ? '2000' : '5.0'}
            label={`Distance in ${def.unit === 'm' ? 'metres' : 'km'}`}
            decimal={def.unit === 'km'}
            maxLength={def.unit === 'm' ? 6 : 6}
            style={tr.input}
            onChange={(dist) => set({ dist })}
          />
        </>
      ) : null}

      <Text style={[tr.label, cs.field]}>EFFORT</Text>
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
      {effort ? <Text style={[tr.faint, cs.under]}>{effort.hint}</Text> : null}

      <View style={[cs.inline, cs.field]}>
        <View style={cs.half}>
          <Text style={tr.label}>AVG HEART RATE</Text>
          <NumField
            value={draft.hr}
            placeholder="Optional"
            label="Average heart rate"
            style={[tr.input, cs.gap]}
            onChange={(hr) => set({ hr })}
          />
        </View>
        <View style={cs.half}>
          <Text style={tr.label}>STARTED AT</Text>
          <TimeField value={draft.time} onChange={(time) => set({ time })} />
        </View>
      </View>
      {!draft.time && draft.date === today ? (
        <Text style={[tr.faint, cs.under]}>
          Leave the start empty if you just finished: Grain counts back from
          now.
        </Text>
      ) : null}

      {error ? <Text style={[cs.error, cs.field]}>{error}</Text> : null}

      <View style={[cs.actions, cs.field]}>
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
        <Pressable onPress={onDelete} hitSlop={8} style={cs.delete}>
          <Text style={[tr.linkText, cs.danger]}>Delete session</Text>
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
      style={[tr.input, cs.gap]}
    />
  );
}

function Row({
  name,
  value,
  sub,
}: {
  name: string;
  value: string;
  sub: string;
}) {
  return (
    <View style={cs.row}>
      <View style={tr.flex1}>
        <Text style={tr.strong}>{name}</Text>
        <Text style={tr.muted}>{sub}</Text>
      </View>
      <Text style={[tr.strong, tr.num]}>{value}</Text>
    </View>
  );
}

const cs = StyleSheet.create({
  top: { marginTop: space.lg },
  button: { marginTop: space.md },
  notice: { marginTop: space.md },
  tip: { marginTop: space.md },
  tipBody: { marginTop: space.sm },
  tipClose: { alignSelf: 'flex-start', marginTop: space.md },
  weekHead: { gap: 2 },
  big: {
    ...typo.title,
    fontSize: 34,
    color: palette.text,
    fontVariant: ['tabular-nums'],
  },
  bar: { marginTop: space.md },
  under: { marginTop: space.sm },
  hair: { marginVertical: space.md },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chips: { marginBottom: space.sm },
  chart: { marginTop: space.lg },
  note: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
  },
  field: { marginTop: space.md },
  inline: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  // flexBasis 0 and minWidth 0 let the boxes shrink to share the row.
  box: { flex: 1, flexBasis: 0, minWidth: 0, textAlign: 'center' },
  half: { flex: 1, flexBasis: 0, minWidth: 0 },
  gap: { marginTop: space.sm, width: '100%', minWidth: 0 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  delete: { alignSelf: 'center', marginTop: space.lg },
  danger: { color: palette.danger },
  error: { color: palette.danger, fontSize: 14 },
  footer: { marginTop: space.xl, lineHeight: 18 },
});

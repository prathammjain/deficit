/**
 * creator.tsx: one creator's page in the CRM. Who they are, where they are
 * in the pipeline, when to follow up, their numbers over time, every message
 * so far, and their Grain account with premium.
 */

import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ChevronIcon } from '@/components/ui/icons';
import {
  Card,
  Hairline,
  PrimaryButton,
  SectionLabel,
} from '@/components/ui/primitives';
import { palette, space, type as typo } from '@/constants/palette';
import {
  PLATFORMS,
  PLATFORM_LABEL,
  STAGES,
  STAGE_LABEL,
  addDays,
  compact,
  followUp,
  growth,
  latestByPlatform,
  parseCount,
  type MetricRow,
  type Platform,
} from '@/lib/admin/format';
import { shortDate } from '@/lib/date';
import { todayKey } from '@/lib/log-store';
import {
  addMetrics,
  addTouch,
  deleteCreator,
  fetchUsers,
  listTouches,
  saveCreator,
  type AdminUser,
  type Creator,
  type CreatorFields,
  type Touch,
} from '@/lib/supabase/admin';

import { PremiumControls } from './users';
import {
  Chips,
  DayPicker,
  ErrorLine,
  Field,
  QuietButton,
  message,
  ui,
} from './ui';

const EMPTY: CreatorFields = {
  name: '',
  handle: null,
  platform: 'instagram',
  niche: null,
  city: null,
  country: null,
  email: null,
  phone: null,
  stage: 'prospect',
  next_follow_up: null,
  grain_user_id: null,
  track_record: null,
  notes: null,
};

/** Trimmed text, or null when there is nothing. */
const clean = (v: string | null) => (v && v.trim() ? v.trim() : null);

/** Only the editable columns, tidied. A saved row also carries id and
 *  timestamps, which must never be written back. */
function tidy(f: CreatorFields): CreatorFields {
  return {
    name: f.name.trim(),
    handle: clean(f.handle),
    platform: f.platform,
    niche: clean(f.niche),
    city: clean(f.city),
    country: clean(f.country),
    email: clean(f.email),
    phone: clean(f.phone),
    stage: f.stage,
    next_follow_up: f.next_follow_up,
    grain_user_id: f.grain_user_id,
    track_record: clean(f.track_record),
    notes: clean(f.notes),
  };
}

const platformName = (p: string | null) =>
  p ? (PLATFORM_LABEL[p as Platform] ?? p) : null;

export function CreatorPage({
  creator,
  metrics,
  adminId,
  onClose,
}: {
  /** Null for a new creator. */
  creator: Creator | null;
  metrics: MetricRow[];
  adminId: string;
  onClose: (changed: boolean) => void;
}) {
  const [saved, setSaved] = useState<Creator | null>(creator);
  const [fields, setFields] = useState<CreatorFields>(creator ?? EMPTY);
  const [editing, setEditing] = useState(creator == null);
  const [changed, setChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (next: CreatorFields): Promise<boolean> => {
    setBusy(true);
    try {
      const out = await saveCreator(tidy(next), saved?.id);
      setSaved(out);
      setFields(out);
      setChanged(true);
      setError(null);
      return true;
    } catch (e) {
      setError(message(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Pressable
        onPress={() => onClose(changed)}
        hitSlop={10}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          marginTop: space.lg,
          marginLeft: -4,
        }}
      >
        <ChevronIcon color={palette.textMuted} />
        <Text
          style={{ color: palette.textMuted, fontSize: 15, fontWeight: '600' }}
        >
          Creators
        </Text>
      </Pressable>

      {saved && !editing ? (
        <View style={{ marginTop: space.lg, gap: 2 }}>
          <Text style={{ ...typo.heading, color: palette.text }}>
            {saved.name}
          </Text>
          <Text style={ui.sub}>
            {[saved.handle, platformName(saved.platform), saved.niche]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      ) : null}

      {editing ? (
        <ProfileForm
          fields={fields}
          onChange={setFields}
          busy={busy}
          onSave={async () => {
            if (await save(fields)) setEditing(false);
          }}
          onCancel={
            saved
              ? () => {
                  setFields(saved);
                  setEditing(false);
                }
              : () => onClose(false)
          }
        />
      ) : null}
      <ErrorLine text={error} />

      {saved && !editing ? (
        <>
          <SectionLabel>Stage</SectionLabel>
          <Chips
            options={STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))}
            value={saved.stage}
            onChange={(stage) => void save({ ...fields, stage })}
          />

          <FollowUp
            date={saved.next_follow_up}
            onChange={(next_follow_up) =>
              void save({ ...fields, next_follow_up })
            }
          />

          <Numbers creator={saved} initial={metrics} />

          <Outreach creatorId={saved.id} />

          <Account
            creator={saved}
            adminId={adminId}
            onLink={(grain_user_id) => save({ ...fields, grain_user_id })}
          />

          <SectionLabel>Details</SectionLabel>
          <Details creator={saved} />
          <QuietButton
            label="Edit details"
            onPress={() => setEditing(true)}
            style={{ marginTop: space.md }}
          />

          <Delete
            onDelete={async () => {
              try {
                await deleteCreator(saved.id);
                onClose(true);
              } catch (e) {
                setError(message(e));
              }
            }}
          />
        </>
      ) : null}
    </View>
  );
}

function ProfileForm({
  fields,
  onChange,
  onSave,
  onCancel,
  busy,
}: {
  fields: CreatorFields;
  onChange: (f: CreatorFields) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const set = (key: keyof CreatorFields) => (text: string) =>
    onChange({ ...fields, [key]: text });
  return (
    <Card style={ui.card}>
      <Field label="Name" value={fields.name} onChangeText={set('name')} />
      <Field
        label="Handle"
        placeholder="@handle"
        value={fields.handle ?? ''}
        onChangeText={set('handle')}
        autoCapitalize="none"
      />
      <Text style={ui.caption}>Main platform</Text>
      <Chips
        options={PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABEL[p] }))}
        value={(fields.platform ?? undefined) as Platform | undefined}
        onChange={(platform) => onChange({ ...fields, platform })}
      />
      <Field
        label="Niche"
        placeholder="Powerlifting, physique, coach"
        value={fields.niche ?? ''}
        onChangeText={set('niche')}
      />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Field
          label="City"
          value={fields.city ?? ''}
          onChangeText={set('city')}
          style={{ flex: 1 }}
        />
        <Field
          label="Country"
          value={fields.country ?? ''}
          onChangeText={set('country')}
          style={{ flex: 1 }}
        />
      </View>
      <Field
        label="Email"
        value={fields.email ?? ''}
        onChangeText={set('email')}
        autoCapitalize="none"
        inputMode="email"
      />
      <Field
        label="Phone or WhatsApp"
        value={fields.phone ?? ''}
        onChangeText={set('phone')}
        inputMode="tel"
      />
      <Field
        label="Track record"
        placeholder="Titles, achievements, past brand work"
        value={fields.track_record ?? ''}
        onChangeText={set('track_record')}
        multiline
      />
      <Field
        label="Notes"
        value={fields.notes ?? ''}
        onChangeText={set('notes')}
        multiline
      />
      <PrimaryButton
        label={busy ? 'Saving' : 'Save'}
        disabled={busy || !fields.name.trim()}
        onPress={onSave}
      />
      <QuietButton label="Cancel" onPress={onCancel} />
    </Card>
  );
}

function Details({ creator: c }: { creator: Creator }) {
  const rows = [
    ['City', c.city],
    ['Country', c.country],
    ['Email', c.email],
    ['Phone', c.phone],
    ['Track record', c.track_record],
    ['Notes', c.notes],
  ].filter(([, v]) => v) as [string, string][];
  if (!rows.length) {
    return (
      <Card>
        <Text style={ui.sub}>Nothing else yet.</Text>
      </Card>
    );
  }
  return (
    <Card style={{ gap: space.md }}>
      {rows.map(([label, value]) => (
        <View key={label} style={{ gap: 2 }}>
          <Text style={ui.caption}>{label}</Text>
          <Text style={ui.line}>{value}</Text>
        </View>
      ))}
    </Card>
  );
}

const FOLLOW_UPS = [
  { days: 0, label: 'Today' },
  { days: 1, label: 'Tomorrow' },
  { days: 3, label: 'In 3 days' },
  { days: 7, label: 'In a week' },
  { days: 14, label: 'In 2 weeks' },
];

function FollowUp({
  date,
  onChange,
}: {
  date: string | null;
  onChange: (date: string | null) => void;
}) {
  const today = todayKey();
  const state = followUp(date, today);
  const options = [
    ...FOLLOW_UPS.map((f) => ({
      value: addDays(today, f.days) as string | null,
      label: f.label,
    })),
    { value: null, label: 'None' },
  ];
  return (
    <>
      <SectionLabel>Follow up</SectionLabel>
      <Text style={[ui.line, state === 'overdue' && { color: palette.accent }]}>
        {date
          ? `${shortDate(date)}${state === 'overdue' ? ', overdue' : state === 'today' ? ', today' : ''}`
          : 'None set'}
      </Text>
      <View style={{ marginTop: space.sm }}>
        <Chips options={options} value={date} onChange={onChange} />
      </View>
    </>
  );
}

function Numbers({
  creator,
  initial,
}: {
  creator: Creator;
  initial: MetricRow[];
}) {
  const [rows, setRows] = useState<MetricRow[]>(initial);
  const [adding, setAdding] = useState(false);
  const latest = latestByPlatform(rows);
  const history = [...rows].sort(
    (a, b) =>
      b.recorded_on.localeCompare(a.recorded_on) ||
      b.created_at.localeCompare(a.created_at),
  );

  return (
    <>
      <SectionLabel>Numbers</SectionLabel>
      {latest.length === 0 ? (
        <Card>
          <Text style={ui.sub}>
            No numbers yet. Every update is kept, so a pitch can show growth.
          </Text>
        </Card>
      ) : null}
      {latest.map(({ latest: m, previous }) => {
        const up = growth(m.followers, previous?.followers ?? null);
        const detail = [
          m.reach != null && `Reach ${compact(m.reach)}`,
          m.weekly_views != null && `Weekly views ${compact(m.weekly_views)}`,
          m.total_views != null && `Total views ${compact(m.total_views)}`,
          m.engagement_rate != null && `Engagement ${m.engagement_rate}%`,
        ].filter(Boolean);
        return (
          <Card key={m.platform} style={ui.card}>
            <View style={ui.statRow}>
              <View style={ui.rowText}>
                <Text style={ui.cardTitle}>
                  {(platformName(m.platform) ?? '').toUpperCase()}
                </Text>
                <Text style={ui.big}>{compact(m.followers)}</Text>
                <Text style={ui.sub}>
                  followers
                  {up && previous
                    ? `, ${up} since ${shortDate(previous.recorded_on)}`
                    : ''}
                </Text>
              </View>
            </View>
            {detail.length ? (
              <Text style={ui.line}>{detail.join(' · ')}</Text>
            ) : null}
            <Text style={ui.caption}>As of {shortDate(m.recorded_on)}</Text>
          </Card>
        );
      })}

      {adding ? (
        <AddNumbers
          creator={creator}
          onCancel={() => setAdding(false)}
          onAdded={(row) => {
            setRows([...rows, row]);
            setAdding(false);
          }}
        />
      ) : (
        <QuietButton
          label="Add numbers"
          onPress={() => setAdding(true)}
          style={{ marginTop: space.md }}
        />
      )}

      {history.length > latest.length ? (
        <Card style={ui.card}>
          <Text style={ui.cardTitle}>HISTORY</Text>
          {history.map((r) => (
            <Text key={r.id} style={ui.sub}>
              {shortDate(r.recorded_on)} · {platformName(r.platform)} ·{' '}
              {compact(r.followers)} followers
              {r.weekly_views != null
                ? ` · ${compact(r.weekly_views)} weekly views`
                : ''}
            </Text>
          ))}
        </Card>
      ) : null}
    </>
  );
}

const COUNT_FIELDS = [
  ['followers', 'Followers'],
  ['reach', 'Reach'],
  ['weekly_views', 'Weekly views'],
  ['total_views', 'Total views'],
] as const;

function AddNumbers({
  creator,
  onAdded,
  onCancel,
}: {
  creator: Creator;
  onAdded: (row: MetricRow) => void;
  onCancel: () => void;
}) {
  const today = todayKey();
  const [platform, setPlatform] = useState<Platform>(
    (PLATFORMS as readonly string[]).includes(creator.platform ?? '')
      ? (creator.platform as Platform)
      : 'instagram',
  );
  const [day, setDay] = useState(today);
  const [text, setText] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const counts: Record<string, number | null> = {};
    for (const [key, label] of COUNT_FIELDS) {
      const raw = (text[key] ?? '').trim();
      const n = raw ? parseCount(raw) : null;
      if (n != null && Number.isNaN(n)) {
        setError(`${label} isn't a number. Try 48200 or 48.2k.`);
        return;
      }
      counts[key] = n;
    }
    const rawRate = (text.engagement_rate ?? '').trim().replace('%', '');
    const rate = rawRate ? Number(rawRate) : null;
    if (rate != null && (Number.isNaN(rate) || rate < 0 || rate > 100)) {
      setError('Engagement is a percent, like 4.2.');
      return;
    }
    if (Object.values(counts).every((v) => v == null) && rate == null) {
      setError('Add at least one number.');
      return;
    }
    setBusy(true);
    try {
      onAdded(
        await addMetrics({
          creator_id: creator.id,
          platform,
          recorded_on: day,
          followers: counts.followers,
          reach: counts.reach,
          weekly_views: counts.weekly_views,
          total_views: counts.total_views,
          engagement_rate: rate,
        }),
      );
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  };

  return (
    <Card style={ui.card}>
      <Chips
        options={PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABEL[p] }))}
        value={platform}
        onChange={setPlatform}
      />
      <DayPicker value={day} today={today} onChange={setDay} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {COUNT_FIELDS.map(([key, label]) => (
          <Field
            key={key}
            label={label}
            placeholder="48.2k"
            value={text[key] ?? ''}
            onChangeText={(v) => setText({ ...text, [key]: v })}
            autoCapitalize="none"
            style={{ flexBasis: '45%', flexGrow: 1 }}
          />
        ))}
        <Field
          label="Engagement %"
          placeholder="4.2"
          value={text.engagement_rate ?? ''}
          onChangeText={(v) => setText({ ...text, engagement_rate: v })}
          inputMode="decimal"
          style={{ flexBasis: '45%', flexGrow: 1 }}
        />
      </View>
      <ErrorLine text={error} />
      <PrimaryButton
        label={busy ? 'Saving' : 'Save numbers'}
        disabled={busy}
        onPress={submit}
      />
      <QuietButton label="Cancel" onPress={onCancel} />
    </Card>
  );
}

const CHANNELS = ['Instagram', 'WhatsApp', 'Email', 'Call', 'In person'];

function Outreach({ creatorId }: { creatorId: string }) {
  const today = todayKey();
  const [touches, setTouches] = useState<Touch[]>([]);
  const [channel, setChannel] = useState('Instagram');
  const [summary, setSummary] = useState('');
  const [day, setDay] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () => listTouches(creatorId).then(setTouches, (e) => setError(message(e))),
    [creatorId],
  );

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    setBusy(true);
    try {
      await addTouch({
        creator_id: creatorId,
        happened_on: day,
        channel,
        summary: summary.trim(),
      });
      setSummary('');
      setDay(today);
      setError(null);
      await load();
    } catch (e) {
      setError(message(e));
    }
    setBusy(false);
  };

  return (
    <>
      <SectionLabel>Outreach log</SectionLabel>
      <Card style={{ gap: space.md }}>
        <Chips
          options={CHANNELS.map((c) => ({ value: c, label: c }))}
          value={channel}
          onChange={setChannel}
        />
        <Field
          placeholder="What was said, what's next"
          value={summary}
          onChangeText={setSummary}
          multiline
        />
        <DayPicker value={day} today={today} onChange={setDay} />
        <ErrorLine text={error} />
        <PrimaryButton
          label={busy ? 'Adding' : 'Add to the log'}
          disabled={busy || !summary.trim()}
          onPress={add}
        />
      </Card>
      {touches.length ? (
        <Card padded={false} style={{ marginTop: space.md }}>
          {touches.map((t, i) => (
            <View key={t.id}>
              {i > 0 ? (
                <Hairline style={{ marginHorizontal: space.xl }} />
              ) : null}
              <View
                style={{
                  padding: space.lg,
                  paddingHorizontal: space.xl,
                  gap: 2,
                }}
              >
                <Text style={ui.caption}>
                  {shortDate(t.happened_on)}
                  {t.channel ? ` · ${t.channel}` : ''}
                </Text>
                <Text style={ui.line}>{t.summary}</Text>
              </View>
            </View>
          ))}
        </Card>
      ) : null}
    </>
  );
}

function Account({
  creator,
  adminId,
  onLink,
}: {
  creator: Creator;
  adminId: string;
  onLink: (userId: string | null) => Promise<boolean>;
}) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const linked = creator.grain_user_id;

  // Only fetched while linked; unlinked, the stored user is simply not shown.
  const load = useCallback(
    () =>
      linked
        ? fetchUsers(linked).then(
            ([u]) => setUser(u ?? null),
            (e) => setError(message(e)),
          )
        : Promise.resolve(),
    [linked],
  );

  useEffect(() => {
    load();
  }, [load]);

  const link = async () => {
    setBusy(true);
    setError(null);
    try {
      const wanted = email.trim().toLowerCase();
      const found = (await fetchUsers(wanted)).find(
        (u) => u.email.toLowerCase() === wanted,
      );
      if (!found) {
        setError(
          'No Grain account uses that email yet. They need to sign in once first.',
        );
      } else if (await onLink(found.user_id)) {
        setEmail('');
      }
    } catch (e) {
      setError(message(e));
    }
    setBusy(false);
  };

  return (
    <>
      <SectionLabel>Grain account</SectionLabel>
      <Card style={{ gap: space.md }}>
        {linked && user ? (
          <>
            <View style={{ gap: 2 }}>
              <Text style={ui.rowTitle}>{user.email}</Text>
              <Text style={ui.sub}>
                Joined {shortDate(user.joined_at)} ·{' '}
                {user.meals_logged
                  ? `${user.meals_logged} meals over ${user.days_logged} days`
                  : 'no meals yet'}
              </Text>
            </View>
            <PremiumControls user={user} adminId={adminId} onChanged={load} />
            <QuietButton
              label="Unlink this account"
              onPress={() => void onLink(null)}
            />
          </>
        ) : (
          <>
            <Text style={ui.sub}>
              Link the account they signed in to Grain with, to gift premium
              from here.
            </Text>
            <Field
              placeholder="Their Grain sign in email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              inputMode="email"
            />
            <QuietButton
              label={busy ? 'Looking' : 'Link account'}
              disabled={busy || !email.trim()}
              onPress={link}
            />
          </>
        )}
        <ErrorLine text={error} />
      </Card>
    </>
  );
}

function Delete({ onDelete }: { onDelete: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <QuietButton
      label={
        armed ? 'Tap again to delete, with all their history' : 'Delete creator'
      }
      onPress={() => (armed ? onDelete() : setArmed(true))}
      style={{ marginTop: space.xxl }}
    />
  );
}

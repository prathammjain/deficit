/**
 * panel.tsx: one creator, open beside the table. Stage and follow up up
 * top, logging a touch one Enter away, then their timeline, numbers, Grain
 * account and details. Also the quick form for adding someone new.
 */

import { useState, type FormEvent } from 'react';

import {
  GIFT_LENGTHS,
  PLATFORMS,
  PLATFORM_LABEL,
  STAGES,
  STAGE_LABEL,
  compact,
  giftEndsAt,
  growth,
  latestByPlatform,
  parseCount,
  type MetricRow,
  type Platform,
  type Stage,
} from '@/lib/admin/format';
import { relativeDay } from '@/lib/admin/crm';
import { shortDate } from '@/lib/date';
import { todayKey } from '@/lib/log-store';
import {
  giftPremium,
  removeGift,
  type AdminUser,
  type Creator,
  type CreatorFields,
} from '@/lib/supabase/admin';

import { message } from '../ui';
import {
  FOLLOW_UPS,
  Sparkline,
  cx,
  followText,
  followUpDay,
  profileUrl,
} from './bits';
import css from './crm.module.css';
import type { Crm } from './state';

const CHANNELS = ['Instagram', 'WhatsApp', 'Email', 'Call', 'In person'];

const clean = (v: string | null | undefined) =>
  v && v.trim() ? v.trim() : null;

/** Only the editable columns, tidied; never the id or timestamps. */
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

export function CreatorPanel({
  crm,
  id,
  adminId,
  onClose,
  onCreated,
}: {
  crm: Crm;
  id: string;
  adminId: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  if (id === 'new') {
    return <NewCreator crm={crm} onClose={onClose} onCreated={onCreated} />;
  }
  const creator = crm.data?.creators.find((c) => c.id === id);
  if (!creator) return null;
  return (
    <ExistingCreator
      crm={crm}
      creator={creator}
      adminId={adminId}
      onClose={onClose}
    />
  );
}

function NewCreator({
  crm,
  onClose,
  onCreated,
}: {
  crm: Crm;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const today = todayKey();
  const [f, setF] = useState<CreatorFields>({
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
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.name.trim() || busy) return;
    setBusy(true);
    const c = await crm.addCreator(tidy(f));
    setBusy(false);
    if (c) onCreated(c.id);
  };

  return (
    <aside className={css.panel}>
      <div className={css.panelHead}>
        <h2>New creator</h2>
        <button className={css.close} onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <form onSubmit={submit} style={{ display: 'contents' }}>
        <Field label="Name">
          <input
            className={css.input}
            autoFocus
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            placeholder="Who are you reaching out to?"
          />
        </Field>
        <div className={css.grid2}>
          <Field label="Handle">
            <input
              className={css.input}
              value={f.handle ?? ''}
              onChange={(e) => setF({ ...f, handle: e.target.value })}
              placeholder="@handle"
            />
          </Field>
          <Field label="Platform">
            <select
              className={css.input}
              value={f.platform ?? 'instagram'}
              onChange={(e) => setF({ ...f, platform: e.target.value })}
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_LABEL[p]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Niche">
            <input
              className={css.input}
              value={f.niche ?? ''}
              onChange={(e) => setF({ ...f, niche: e.target.value })}
              placeholder="Powerlifting, physique, coach"
            />
          </Field>
          <Field label="City">
            <input
              className={css.input}
              value={f.city ?? ''}
              onChange={(e) => setF({ ...f, city: e.target.value })}
            />
          </Field>
          <Field label="Stage">
            <select
              className={css.input}
              value={f.stage}
              onChange={(e) => setF({ ...f, stage: e.target.value as Stage })}
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Follow up">
            <select
              className={css.input}
              value={FOLLOW_UPS.findIndex(
                (o) => followUpDay(o.days, today) === f.next_follow_up,
              )}
              onChange={(e) => {
                const o = FOLLOW_UPS[Number(e.target.value)];
                setF({ ...f, next_follow_up: followUpDay(o.days, today) });
              }}
            >
              {FOLLOW_UPS.map((o, i) => (
                <option key={o.label} value={i}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className={css.row}>
          <button
            type="submit"
            className={cx(css.btn, css.primary)}
            disabled={!f.name.trim() || busy}
          >
            {busy ? 'Adding' : 'Add creator'}
          </button>
          <span className={css.note}>Enter adds them. The rest can wait.</span>
        </div>
      </form>
    </aside>
  );
}

function ExistingCreator({
  crm,
  creator: c,
  adminId,
  onClose,
}: {
  crm: Crm;
  creator: Creator;
  adminId: string;
  onClose: () => void;
}) {
  const today = todayKey();
  const touches = (crm.data?.touches ?? []).filter(
    (t) => t.creator_id === c.id,
  );
  const metrics = (crm.data?.metrics ?? []).filter(
    (m) => m.creator_id === c.id,
  );
  const user = c.grain_user_id
    ? crm.data?.users.find((u) => u.user_id === c.grain_user_id)
    : undefined;
  const url = profileUrl(c.platform, c.handle);

  return (
    <aside className={css.panel}>
      <div className={css.panelHead}>
        <div>
          <h2>{c.name}</h2>
          <div className={css.panelSub}>
            {url ? (
              <a href={url} target="_blank" rel="noreferrer">
                {c.handle}
              </a>
            ) : (
              c.handle
            )}
            {[platformName(c.platform), c.niche, c.city]
              .filter(Boolean)
              .map((v) => ` · ${v}`)
              .join('')}
          </div>
        </div>
        <button className={css.close} onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className={css.segs}>
        {STAGES.map((s) => (
          <button
            key={s}
            className={cx(css.seg, c.stage === s && css.segOn)}
            onClick={() => crm.patchCreators([c.id], { stage: s })}
          >
            {STAGE_LABEL[s]}
          </button>
        ))}
      </div>

      <div className={css.field}>
        <span className={css.label}>
          Follow up:{' '}
          <span
            className={
              c.next_follow_up && c.next_follow_up <= today
                ? css.hot
                : undefined
            }
          >
            {c.next_follow_up
              ? `${shortDate(c.next_follow_up)}, ${followText(c.next_follow_up, today)}`
              : 'none'}
          </span>
        </span>
        <div className={css.segs}>
          {FOLLOW_UPS.map((o) => {
            const day = followUpDay(o.days, today);
            return (
              <button
                key={o.label}
                className={cx(css.seg, c.next_follow_up === day && css.segOn)}
                onClick={() =>
                  crm.patchCreators([c.id], { next_follow_up: day })
                }
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      <LogTouch crm={crm} creatorId={c.id} />

      <div className={css.section}>
        <div className={css.sectionTitle}>
          Timeline
          <span>{touches.length || ''}</span>
        </div>
        {touches.length === 0 ? (
          <div className={css.note}>No touches yet.</div>
        ) : (
          touches.map((t) => (
            <div key={t.id} className={css.tItem}>
              <span className={css.tMeta}>
                {shortDate(t.happened_on)} · {relativeDay(t.happened_on, today)}
                {t.channel ? ` · ${t.channel}` : ''}
              </span>
              <span className={css.tText}>{t.summary}</span>
            </div>
          ))
        )}
      </div>

      <Numbers crm={crm} creator={c} rows={metrics} />

      <Account crm={crm} creator={c} user={user} adminId={adminId} />

      <Details crm={crm} creator={c} />

      <DeleteButton crm={crm} creator={c} onDeleted={onClose} />
    </aside>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className={css.field}>
      <span className={css.label}>{label}</span>
      {children}
    </label>
  );
}

function LogTouch({ crm, creatorId }: { crm: Crm; creatorId: string }) {
  const today = todayKey();
  const [channel, setChannel] = useState('Instagram');
  const [summary, setSummary] = useState('');
  const [day, setDay] = useState(today);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!summary.trim() || busy) return;
    setBusy(true);
    const ok = await crm.logTouch({
      creator_id: creatorId,
      happened_on: day,
      channel,
      summary: summary.trim(),
    });
    setBusy(false);
    if (ok) {
      setSummary('');
      setDay(today);
    }
  };

  return (
    <div className={css.section}>
      <div className={css.sectionTitle}>Log a touch</div>
      <div className={css.segs}>
        {CHANNELS.map((ch) => (
          <button
            key={ch}
            className={cx(css.seg, channel === ch && css.segOn)}
            onClick={() => setChannel(ch)}
          >
            {ch}
          </button>
        ))}
      </div>
      <textarea
        className={css.input}
        placeholder="What happened, what's next. Enter saves, Shift Enter for a new line."
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void save();
          }
        }}
      />
      <div className={css.row}>
        <input
          type="date"
          className={css.input}
          style={{ width: 160 }}
          value={day}
          max={today}
          onChange={(e) => e.target.value && setDay(e.target.value)}
        />
        <button
          className={cx(css.btn, css.small)}
          disabled={!summary.trim() || busy}
          onClick={() => void save()}
        >
          {busy ? 'Saving' : 'Log it'}
        </button>
      </div>
    </div>
  );
}

const COUNT_FIELDS = [
  ['followers', 'Followers'],
  ['reach', 'Reach'],
  ['weekly_views', 'Weekly views'],
  ['total_views', 'Total views'],
] as const;

function Numbers({
  crm,
  creator,
  rows,
}: {
  crm: Crm;
  creator: Creator;
  rows: MetricRow[];
}) {
  const today = todayKey();
  const [adding, setAdding] = useState(false);
  const [platform, setPlatform] = useState<string>(
    creator.platform ?? 'instagram',
  );
  const [day, setDay] = useState(today);
  const [text, setText] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const latest = latestByPlatform(rows);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
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
    const ok = await crm.addMetric({
      creator_id: creator.id,
      platform,
      recorded_on: day,
      followers: counts.followers,
      reach: counts.reach,
      weekly_views: counts.weekly_views,
      total_views: counts.total_views,
      engagement_rate: rate,
    });
    setBusy(false);
    if (ok) {
      setText({});
      setError(null);
      setAdding(false);
    }
  };

  return (
    <div className={css.section}>
      <div className={css.sectionTitle}>
        Numbers
        <button
          className={cx(css.btn, css.small)}
          onClick={() => setAdding(!adding)}
        >
          {adding ? 'Cancel' : 'Update numbers'}
        </button>
      </div>

      {adding ? (
        <form onSubmit={submit} style={{ display: 'contents' }}>
          <div className={css.grid2}>
            <Field label="Platform">
              <select
                className={css.input}
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_LABEL[p]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="As of">
              <input
                type="date"
                className={css.input}
                value={day}
                max={today}
                onChange={(e) => e.target.value && setDay(e.target.value)}
              />
            </Field>
            {COUNT_FIELDS.map(([key, label], i) => (
              <Field key={key} label={label}>
                <input
                  className={css.input}
                  autoFocus={i === 0}
                  placeholder="48.2k"
                  value={text[key] ?? ''}
                  onChange={(e) => setText({ ...text, [key]: e.target.value })}
                />
              </Field>
            ))}
            <Field label="Engagement %">
              <input
                className={css.input}
                placeholder="4.2"
                value={text.engagement_rate ?? ''}
                onChange={(e) =>
                  setText({ ...text, engagement_rate: e.target.value })
                }
              />
            </Field>
          </div>
          {error ? <div className={css.hot}>{error}</div> : null}
          <div className={css.row}>
            <button
              type="submit"
              className={cx(css.btn, css.primary, css.small)}
              disabled={busy}
            >
              {busy ? 'Saving' : 'Save numbers'}
            </button>
            <span className={css.note}>
              Every update is kept, so a pitch can show growth.
            </span>
          </div>
        </form>
      ) : null}

      {latest.length === 0 && !adding ? (
        <div className={css.note}>No numbers yet.</div>
      ) : null}
      {latest.map(({ latest: m, previous }) => {
        const history = rows
          .filter((r) => r.platform === m.platform && r.followers != null)
          .sort((a, b) => a.recorded_on.localeCompare(b.recorded_on))
          .map((r) => r.followers as number);
        const up = growth(m.followers, previous?.followers ?? null);
        const detail = [
          m.reach != null && `Reach ${compact(m.reach)}`,
          m.weekly_views != null && `Weekly views ${compact(m.weekly_views)}`,
          m.total_views != null && `Total views ${compact(m.total_views)}`,
          m.engagement_rate != null && `Engagement ${m.engagement_rate}%`,
        ].filter(Boolean);
        return (
          <div key={m.platform} className={css.metric}>
            <div className={css.metricTop}>
              <span className={css.label}>
                {platformName(m.platform)}, as of {shortDate(m.recorded_on)}
              </span>
              <Sparkline values={history} />
            </div>
            <div>
              <span className={css.metricBig}>{compact(m.followers)}</span>{' '}
              <span className={css.muted}>
                followers
                {up && previous
                  ? `, ${up} since ${shortDate(previous.recorded_on)}`
                  : ''}
              </span>
            </div>
            {detail.length ? (
              <div className={css.metricLine}>{detail.join(' · ')}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function Account({
  crm,
  creator,
  user,
  adminId,
}: {
  crm: Crm;
  creator: Creator;
  user: AdminUser | undefined;
  adminId: string;
}) {
  const [email, setEmail] = useState('');
  const [months, setMonths] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    }
    setBusy(false);
  };

  const link = () =>
    run(async () => {
      const wanted = email.trim().toLowerCase();
      const found = crm.data?.users.find(
        (u) => u.email.toLowerCase() === wanted,
      );
      if (!found) {
        throw new Error(
          'No Grain account uses that email yet. They need to sign in once first.',
        );
      }
      await crm.patchCreators([creator.id], { grain_user_id: found.user_id });
      setEmail('');
    });

  const live =
    user?.premium_source != null &&
    (!user.premium_ends_at || new Date(user.premium_ends_at) > new Date());

  return (
    <div className={css.section}>
      <div className={css.sectionTitle}>Grain account</div>
      {creator.grain_user_id && user ? (
        <>
          <div>
            <div className={css.name}>{user.email}</div>
            <div className={css.muted}>
              Joined {shortDate(user.joined_at)} ·{' '}
              {user.meals_logged
                ? `${user.meals_logged} meals over ${user.days_logged} days`
                : 'no meals yet'}
              {user.last_active_at
                ? ` · active ${shortDate(user.last_active_at)}`
                : ''}
            </div>
          </div>
          {live ? (
            <div className={css.row}>
              <span>
                {user.premium_source === 'gift'
                  ? 'Premium gifted'
                  : 'Paid premium'}
                ,{' '}
                {user.premium_ends_at
                  ? `until ${shortDate(user.premium_ends_at)}`
                  : 'no end date'}
              </span>
              {user.premium_source === 'gift' ? (
                <button
                  className={cx(css.btn, css.small)}
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await removeGift(user.user_id);
                      await crm.refreshUsers();
                    })
                  }
                >
                  Remove the gift
                </button>
              ) : null}
            </div>
          ) : (
            <div className={css.row}>
              <select
                className={css.input}
                style={{ width: 140 }}
                value={months ?? ''}
                onChange={(e) =>
                  setMonths(e.target.value ? Number(e.target.value) : null)
                }
              >
                {GIFT_LENGTHS.map((g) => (
                  <option key={g.label} value={g.months ?? ''}>
                    {g.label}
                  </option>
                ))}
              </select>
              <input
                className={css.input}
                style={{ flex: 1, minWidth: 120 }}
                placeholder="Note, e.g. founding athlete"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button
                className={cx(css.btn, css.primary, css.small)}
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await giftPremium(
                      user.user_id,
                      giftEndsAt(months),
                      note,
                      adminId,
                    );
                    await crm.refreshUsers();
                    setNote('');
                  })
                }
              >
                Gift premium
              </button>
            </div>
          )}
          <button
            className={css.linkBtn}
            onClick={() =>
              crm.patchCreators([creator.id], { grain_user_id: null })
            }
          >
            Unlink this account
          </button>
        </>
      ) : (
        <div className={css.row}>
          <input
            className={css.input}
            style={{ flex: 1 }}
            placeholder="Their Grain sign in email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && email.trim()) void link();
            }}
          />
          <button
            className={cx(css.btn, css.small)}
            disabled={busy || !email.trim()}
            onClick={() => void link()}
          >
            Link
          </button>
        </div>
      )}
      {error ? <div className={css.hot}>{error}</div> : null}
    </div>
  );
}

/** The fields the Details section edits. Stage, follow up and the linked
 *  account change elsewhere and are left out of the comparison. */
const DETAIL_KEYS = [
  'name',
  'handle',
  'platform',
  'niche',
  'city',
  'country',
  'email',
  'phone',
  'track_record',
  'notes',
] as const;

function Details({ crm, creator }: { crm: Crm; creator: Creator }) {
  const [f, setF] = useState<CreatorFields>(creator);
  const [busy, setBusy] = useState(false);
  const a = tidy(f);
  const b = tidy(creator);
  const dirty = DETAIL_KEYS.some((k) => a[k] !== b[k]);
  const set =
    (key: keyof CreatorFields) => (e: { target: { value: string } }) =>
      setF({ ...f, [key]: e.target.value });

  const save = async () => {
    if (!f.name.trim() || busy) return;
    setBusy(true);
    // Stage and follow up change elsewhere; never overwrite them from here.
    await crm.saveDetails(creator.id, {
      ...tidy(f),
      stage: creator.stage,
      next_follow_up: creator.next_follow_up,
      grain_user_id: creator.grain_user_id,
    });
    setBusy(false);
  };

  return (
    <div
      className={css.section}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && dirty) void save();
      }}
    >
      <div className={css.sectionTitle}>
        Details
        {dirty ? (
          <span className={css.row}>
            <button
              className={cx(css.btn, css.small)}
              onClick={() => setF(creator)}
            >
              Discard
            </button>
            <button
              className={cx(css.btn, css.primary, css.small)}
              disabled={busy || !f.name.trim()}
              onClick={() => void save()}
            >
              {busy ? 'Saving' : 'Save'}
            </button>
          </span>
        ) : null}
      </div>
      <div className={css.grid2}>
        <Field label="Name">
          <input className={css.input} value={f.name} onChange={set('name')} />
        </Field>
        <Field label="Handle">
          <input
            className={css.input}
            value={f.handle ?? ''}
            onChange={set('handle')}
          />
        </Field>
        <Field label="Platform">
          <select
            className={css.input}
            value={f.platform ?? 'instagram'}
            onChange={set('platform')}
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABEL[p]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Niche">
          <input
            className={css.input}
            value={f.niche ?? ''}
            onChange={set('niche')}
          />
        </Field>
        <Field label="City">
          <input
            className={css.input}
            value={f.city ?? ''}
            onChange={set('city')}
          />
        </Field>
        <Field label="Country">
          <input
            className={css.input}
            value={f.country ?? ''}
            onChange={set('country')}
          />
        </Field>
        <Field label="Email">
          <input
            className={css.input}
            value={f.email ?? ''}
            onChange={set('email')}
          />
        </Field>
        <Field label="Phone or WhatsApp">
          <input
            className={css.input}
            value={f.phone ?? ''}
            onChange={set('phone')}
          />
        </Field>
      </div>
      <Field label="Track record">
        <textarea
          className={css.input}
          placeholder="Titles, achievements, past brand work"
          value={f.track_record ?? ''}
          onChange={set('track_record')}
        />
      </Field>
      <Field label="Notes">
        <textarea
          className={css.input}
          value={f.notes ?? ''}
          onChange={set('notes')}
        />
      </Field>
      {dirty ? <div className={css.note}>Cmd Enter saves.</div> : null}
    </div>
  );
}

function DeleteButton({
  crm,
  creator,
  onDeleted,
}: {
  crm: Crm;
  creator: Creator;
  onDeleted: () => void;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <div className={css.section}>
      <button
        className={cx(css.btn, css.small, css.danger)}
        style={{ alignSelf: 'flex-start' }}
        onClick={async () => {
          if (!armed) return setArmed(true);
          if (await crm.removeCreator(creator.id)) onDeleted();
        }}
        onBlur={() => setArmed(false)}
      >
        {armed
          ? 'Click again to delete, with all their history'
          : 'Delete creator'}
      </button>
    </div>
  );
}

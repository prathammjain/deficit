/**
 * people.tsx: everyone with a Grain account, as a laptop table. How active
 * they are, GrainAI let in with one click, premium gifted in two, the
 * GrainAI invite switch and daily limit, and the paywall switch. Account
 * details and counts only, never anyone's meals.
 */

import { useEffect, useMemo, useState } from 'react';

import { GIFT_LENGTHS, giftEndsAt } from '@/lib/admin/format';
import { shortDate } from '@/lib/date';
import { todayKey } from '@/lib/log-store';
import {
  fetchAiSettings,
  fetchUsers,
  giftPremium,
  grantAi,
  removeGift,
  revokeAi,
  saveAiSettings,
  setPaywall,
  type AdminUser,
  type AiSettings,
} from '@/lib/supabase/admin';

import { message } from '../ui';
import { cx } from './bits';
import css from './crm.module.css';

const live = (u: AdminUser) =>
  u.premium_source != null &&
  (!u.premium_ends_at || new Date(u.premium_ends_at) > new Date());

export function PeopleTable({
  adminId,
  paywall: initialPaywall,
}: {
  adminId: string;
  paywall: boolean;
}) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [months, setMonths] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [paywall, setPaywallOn] = useState(initialPaywall);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ai, setAi] = useState<AiSettings | null>(null);
  const [limitText, setLimitText] = useState('');

  const load = () => fetchUsers('').then(setUsers, (e) => setError(message(e)));

  useEffect(() => {
    fetchUsers('').then(setUsers, (e) => setError(message(e)));
    fetchAiSettings().then(
      (s) => {
        setAi(s);
        setLimitText(String(s.dailyLimit));
      },
      (e) => setError(message(e)),
    );
  }, []);

  const saveLimit = () => {
    const n = Math.round(Number(limitText));
    if (!ai || !Number.isFinite(n) || n < 0 || n > 500 || n === ai.dailyLimit) {
      setLimitText(String(ai?.dailyLimit ?? ''));
      return;
    }
    void run(async () => {
      await saveAiSettings({ ...ai, dailyLimit: n });
      setAi({ ...ai, dailyLimit: n });
    });
  };

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(message(e));
    }
    setBusy(false);
  };

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () => (users ?? []).filter((u) => !q || u.email.toLowerCase().includes(q)),
    [users, q],
  );
  const gifted = (users ?? []).filter(
    (u) => live(u) && u.premium_source === 'gift',
  );
  const invited = (users ?? []).filter((u) => u.ai_invited);

  return (
    <div>
      <div className={css.head}>
        <h1>Users</h1>
        <div className={css.headActions}>
          <input
            className={css.search}
            placeholder="Search by email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {ai ? (
            <>
              <button
                className={cx(css.btn, ai.inviteOnly && css.primary)}
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await saveAiSettings({ ...ai, inviteOnly: !ai.inviteOnly });
                    setAi({ ...ai, inviteOnly: !ai.inviteOnly });
                  })
                }
                title="On: only people you invite (and admins) can use GrainAI. Off: everyone can."
              >
                GrainAI invite only {ai.inviteOnly ? 'on' : 'off'}
              </button>
              <label
                className={css.muted}
                title="GrainAI meals per person per day. Voice notes and roasts get the same number each."
              >
                <input
                  className={css.input}
                  style={{ width: 56, textAlign: 'right' }}
                  inputMode="numeric"
                  value={limitText}
                  onChange={(e) =>
                    setLimitText(e.target.value.replace(/\D/g, ''))
                  }
                  onBlur={saveLimit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveLimit();
                  }}
                />{' '}
                a day
              </label>
            </>
          ) : null}
          <button
            className={cx(css.btn, paywall && css.primary)}
            disabled={busy}
            onClick={() =>
              run(async () => {
                await setPaywall(!paywall);
                setPaywallOn(!paywall);
              })
            }
            title="Off means everyone gets every feature. Keep it off until payments work."
          >
            Paywall {paywall ? 'on' : 'off'}
          </button>
        </div>
      </div>

      <div
        className={css.kpis}
        style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}
      >
        <div className={css.kpi}>
          <span className={css.kpiLabel}>Accounts</span>
          <span className={css.kpiValue}>{users?.length ?? ''}</span>
        </div>
        <div className={css.kpi}>
          <span className={css.kpiLabel}>Logged at least once</span>
          <span className={css.kpiValue}>
            {users ? users.filter((u) => u.meals_logged > 0).length : ''}
          </span>
        </div>
        <div className={css.kpi}>
          <span className={css.kpiLabel}>In GrainAI</span>
          <span className={css.kpiValue}>{users ? invited.length : ''}</span>
          <span className={css.kpiSub}>
            {ai
              ? ai.inviteOnly
                ? `Invite only, ${ai.dailyLimit} meals a day`
                : `Open to everyone, ${ai.dailyLimit} a day`
              : ''}
          </span>
        </div>
        <div className={css.kpi}>
          <span className={css.kpiLabel}>Premium, gifted</span>
          <span className={css.kpiValue}>{users ? gifted.length : ''}</span>
        </div>
        <div className={css.kpi}>
          <span className={css.kpiLabel}>Paywall</span>
          <span className={css.kpiValue}>{paywall ? 'On' : 'Off'}</span>
          <span className={css.kpiSub}>
            {paywall
              ? 'Premium needs a gift or a plan'
              : 'Everyone gets everything'}
          </span>
        </div>
      </div>

      {error ? (
        <div
          className={css.errorBar}
          style={{ borderRadius: 12, marginBottom: 12 }}
        >
          {error}
        </div>
      ) : null}

      <div className={css.tableWrap}>
        {users == null ? (
          <div className={css.empty}>Loading users</div>
        ) : (
          <table className={css.table}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Joined</th>
                <th>Last active</th>
                <th className={css.num}>Days logged</th>
                <th className={css.num}>Meals</th>
                <th>GrainAI</th>
                <th>Premium</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((u) => (
                <UserRow
                  key={u.user_id}
                  user={u}
                  open={open === u.user_id}
                  onToggle={() => {
                    setOpen(open === u.user_id ? null : u.user_id);
                    setMonths(null);
                    setNote('');
                  }}
                  months={months}
                  setMonths={setMonths}
                  note={note}
                  setNote={setNote}
                  busy={busy}
                  onGift={() =>
                    run(() =>
                      giftPremium(u.user_id, giftEndsAt(months), note, adminId),
                    )
                  }
                  onRemove={() => run(() => removeGift(u.user_id))}
                  onAi={() =>
                    run(() =>
                      u.ai_invited
                        ? revokeAi(u.user_id)
                        : grantAi(u.user_id, adminId),
                    )
                  }
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function UserRow({
  user: u,
  open,
  onToggle,
  months,
  setMonths,
  note,
  setNote,
  busy,
  onGift,
  onRemove,
  onAi,
}: {
  user: AdminUser;
  open: boolean;
  onToggle: () => void;
  months: number | null;
  setMonths: (m: number | null) => void;
  note: string;
  setNote: (n: string) => void;
  busy: boolean;
  onGift: () => void;
  onRemove: () => void;
  onAi: () => void;
}) {
  const isLive = live(u);
  const today = u.ai_last_day === todayKey() ? (u.ai_last_used ?? 0) : 0;
  return (
    <>
      <tr onClick={onToggle} className={open ? css.rowOpen : undefined}>
        <td className={css.name}>{u.email}</td>
        <td className={css.muted}>{shortDate(u.joined_at)}</td>
        <td className={css.muted}>
          {u.last_active_at ? shortDate(u.last_active_at) : ''}
        </td>
        <td className={css.num}>{u.days_logged || ''}</td>
        <td className={css.num}>{u.meals_logged || ''}</td>
        <td onClick={(e) => e.stopPropagation()}>
          <button
            className={cx(css.btn, css.small, !u.ai_invited && css.primary)}
            disabled={busy}
            onClick={onAi}
            title={u.ai_invited ? 'Remove GrainAI access' : 'Let into GrainAI'}
          >
            {u.ai_invited ? 'Invited' : 'Invite'}
          </button>
          {u.ai_invited && today ? (
            <span className={css.faint}> {today} today</span>
          ) : null}
        </td>
        <td>
          {isLive ? (
            <span className={css.badge} style={{ marginLeft: 0 }}>
              {u.premium_source === 'gift' ? 'Gift' : 'Paid'}
              {u.premium_ends_at
                ? `, until ${shortDate(u.premium_ends_at)}`
                : ''}
            </span>
          ) : u.premium_source === 'gift' && u.premium_ends_at ? (
            <span className={css.faint}>
              gift ended {shortDate(u.premium_ends_at)}
            </span>
          ) : (
            <span className={css.faint}>free</span>
          )}
        </td>
        <td className={css.num}>
          <button className={cx(css.btn, css.small)}>
            {isLive && u.premium_source === 'gift' ? 'Manage' : 'Gift premium'}
          </button>
        </td>
      </tr>
      {open ? (
        <tr className={css.rowOpen}>
          <td colSpan={8} onClick={(e) => e.stopPropagation()}>
            {isLive && u.premium_source === 'gift' ? (
              <div className={css.row}>
                <span>
                  Premium gifted,{' '}
                  {u.premium_ends_at
                    ? `until ${shortDate(u.premium_ends_at)}`
                    : 'no end date'}
                </span>
                <button
                  className={cx(css.btn, css.small)}
                  disabled={busy}
                  onClick={onRemove}
                >
                  Remove the gift
                </button>
              </div>
            ) : isLive ? (
              <span>Paid subscription. Manage it in the payment provider.</span>
            ) : (
              <div className={css.row}>
                <select
                  className={css.input}
                  style={{ width: 150 }}
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
                  style={{ width: 280 }}
                  placeholder="Note, e.g. founding athlete"
                  value={note}
                  autoFocus
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onGift();
                  }}
                />
                <button
                  className={cx(css.btn, css.primary, css.small)}
                  disabled={busy}
                  onClick={onGift}
                >
                  Gift premium
                </button>
              </div>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}

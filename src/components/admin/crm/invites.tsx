/**
 * invites.tsx: GrainAI invite requests from the landing page, above the
 * users table. Someone who has signed up with the same email can be let in
 * with one click; anyone else waits until they do. Done hides a request
 * from the open list.
 */

import { useEffect, useState } from 'react';

import { shortDate } from '@/lib/date';
import {
  fetchInviteRequests,
  grantAi,
  setInviteHandled,
  type InviteRequest,
} from '@/lib/supabase/admin';

import { message } from '../ui';
import { cx } from './bits';
import css from './crm.module.css';

const GOALS: Record<string, string> = {
  fat_loss: 'Fat loss',
  muscle: 'Muscle gain',
  strength: 'Strength',
  hyrox: 'HYROX',
  coaching: 'Coach',
  creator: 'Creator',
  other: 'Other',
};

export function InviteRequests({
  adminId,
  onGranted,
}: {
  adminId: string;
  /** The users table reloads, so its GrainAI column stays true. */
  onGranted: () => void;
}) {
  const [rows, setRows] = useState<InviteRequest[] | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    fetchInviteRequests().then(setRows, (e) => setError(message(e)));

  useEffect(() => {
    fetchInviteRequests().then(setRows, (e) => setError(message(e)));
  }, []);

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

  const open = (rows ?? []).filter((r) => !r.handled_at);
  const shown = showDone ? (rows ?? []) : open;
  if (rows && !rows.length) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div className={css.sectionTitle} style={{ marginBottom: 8 }}>
        <span>
          GrainAI invite requests{rows ? `, ${open.length} open` : ''}
        </span>
        <button
          className={cx(css.btn, css.small)}
          onClick={() => setShowDone(!showDone)}
        >
          {showDone ? 'Open only' : 'Show done too'}
        </button>
      </div>
      {error ? (
        <div
          className={css.errorBar}
          style={{ borderRadius: 12, marginBottom: 8 }}
        >
          {error}
        </div>
      ) : null}
      <div className={css.tableWrap}>
        {rows == null ? (
          <div className={css.empty}>Loading requests</div>
        ) : shown.length === 0 ? (
          <div className={css.empty}>No open requests.</div>
        ) : (
          <table className={css.table}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Trains for</th>
                <th>Instagram</th>
                <th>Asked</th>
                <th>Account</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td>{r.email}</td>
                  <td>{r.name ?? ''}</td>
                  <td>{r.goal ? (GOALS[r.goal] ?? r.goal) : ''}</td>
                  <td>
                    {r.instagram ? (
                      <a
                        href={`https://instagram.com/${encodeURIComponent(r.instagram)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        @{r.instagram}
                      </a>
                    ) : (
                      ''
                    )}
                  </td>
                  <td>{shortDate(r.created_at)}</td>
                  <td className={css.muted}>
                    {!r.user_id
                      ? 'Not signed up yet'
                      : r.ai_invited
                        ? 'In GrainAI'
                        : 'Signed up'}
                  </td>
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {r.user_id && !r.ai_invited ? (
                      <button
                        className={cx(css.btn, css.small, css.primary)}
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            await grantAi(r.user_id as string, adminId);
                            await setInviteHandled(r.id, true);
                            onGranted();
                          })
                        }
                      >
                        Let in
                      </button>
                    ) : null}{' '}
                    <button
                      className={cx(css.btn, css.small)}
                      disabled={busy}
                      onClick={() =>
                        run(() => setInviteHandled(r.id, !r.handled_at))
                      }
                    >
                      {r.handled_at ? 'Reopen' : 'Done'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

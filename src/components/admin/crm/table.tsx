/**
 * table.tsx: the creators table, the CRM's main screen on a laptop. A
 * decision strip on top, saved views, and a dense table sorted by who needs
 * you first. Stage and follow up change right in the row; several rows
 * change at once with bulk actions; the keyboard drives all of it.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';

import {
  SORTS,
  VIEWS,
  buildRows,
  funnel,
  inView,
  needsAction,
  relativeDay,
  rosterReach,
  sortRows,
  toCsv,
  type CreatorRow,
  type SortKey,
  type View,
} from '@/lib/admin/crm';
import {
  PLATFORM_LABEL,
  STAGES,
  STAGE_LABEL,
  compact,
  type Platform,
  type Stage,
} from '@/lib/admin/format';
import { shortDate } from '@/lib/date';
import { todayKey } from '@/lib/log-store';
import type { Creator, CreatorFields } from '@/lib/supabase/admin';

import {
  FOLLOW_UPS,
  FollowSelect,
  Kbd,
  StageSelect,
  cx,
  downloadFile,
  followUpDay,
  isTyping,
} from './bits';
import css from './crm.module.css';
import type { Crm } from './state';

type Row = CreatorRow<Creator>;

/** Columns marked `wide` step aside while a creator is open beside the table. */
/** `fit` names the narrow window class that hides a column (see the CSS). */
const COLUMNS: {
  key: SortKey | null;
  label: string;
  num?: boolean;
  wide?: boolean;
  fit?: 'fit1' | 'fit2';
}[] = [
  { key: 'name', label: 'Creator' },
  { key: 'stage', label: 'Stage' },
  { key: 'niche', label: 'Niche', wide: true, fit: 'fit2' },
  { key: null, label: 'City', wide: true, fit: 'fit1' },
  { key: 'followers', label: 'Followers', num: true },
  { key: 'growth', label: 'Growth', num: true, wide: true, fit: 'fit2' },
  { key: 'engagement', label: 'Eng.', num: true, wide: true, fit: 'fit1' },
  { key: 'lastTouch', label: 'Last touch' },
  { key: 'followUp', label: 'Follow up' },
  { key: null, label: 'On Grain', wide: true, fit: 'fit2' },
];

const SHORTCUTS: [string, string][] = [
  ['J  K', 'Move down and up'],
  ['Enter', 'Open the creator'],
  ['Esc', 'Close the panel'],
  ['/', 'Search'],
  ['N', 'New creator'],
  ['X', 'Select the row'],
  ['1 to 7', 'Set the stage'],
  ['T', 'Follow up tomorrow'],
  ['W', 'Follow up in a week'],
  ['?', 'These shortcuts'],
];

function matches(c: Creator, q: string): boolean {
  if (!q) return true;
  return [c.name, c.handle, c.niche, c.city, c.country, c.email]
    .filter(Boolean)
    .some((v) => v!.toLowerCase().includes(q));
}

const pct = (n: number | null, digits = 1) =>
  n == null ? '' : `${n.toFixed(digits)}%`;

export function CreatorsTable({
  crm,
  open,
  onOpen,
}: {
  crm: Crm;
  open: string | null;
  onOpen: (id: string | null) => void;
}) {
  const today = todayKey();
  const [view, setView] = useState<View>('action');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({
    key: 'urgency',
    dir: 1,
  });
  const [cursor, setCursor] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [help, setHelp] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const data = crm.data;
  const all = useMemo<Row[]>(
    () =>
      data ? buildRows(data.creators, data.metrics, data.touches, today) : [],
    [data, today],
  );
  const users = useMemo(
    () => new Map((data?.users ?? []).map((u) => [u.user_id, u])),
    [data],
  );
  const q = query.trim().toLowerCase();
  const rows = useMemo(
    () =>
      sortRows(
        all.filter(
          (r) =>
            inView(view, r.creator, today, r.lastTouch != null) &&
            matches(r.creator, q),
        ),
        sort.key,
        sort.dir,
      ),
    [all, view, q, sort, today],
  );
  const stats = useMemo(() => {
    const creators = all.map((r) => r.creator);
    const live = creators.filter((c) => c.stage !== 'declined');
    return {
      funnel: funnel(creators),
      reach: rosterReach(all),
      dueToday: live.filter((c) => c.next_follow_up === today).length,
      overdue: live.filter((c) => c.next_follow_up && c.next_follow_up < today)
        .length,
      repliedWaiting: live.filter(
        (c) => c.stage === 'replied' && !c.next_follow_up,
      ).length,
      views: Object.fromEntries(
        VIEWS.map((v) => [
          v.value,
          all.filter((r) =>
            inView(v.value, r.creator, today, r.lastTouch != null),
          ).length,
        ]),
      ) as Record<View, number>,
    };
  }, [all, today]);

  const at = Math.max(0, Math.min(cursor, rows.length - 1));
  // Side by side only from 1400px; narrower, the panel opens over the table
  // and every column stays (see the CSS).
  const { width } = useWindowDimensions();
  const compactCols = open != null && width >= 1400;
  const targets = (row: Row | undefined) =>
    checked.size ? [...checked] : row ? [row.creator.id] : [];

  const patch = (ids: string[], p: Partial<CreatorFields>) => {
    if (ids.length) void crm.patchCreators(ids, p);
  };

  const exportCsv = () => {
    const chosen = checked.size
      ? rows.filter((r) => checked.has(r.creator.id))
      : rows;
    const csv = toCsv(
      [
        'Name',
        'Handle',
        'Platform',
        'Niche',
        'City',
        'Country',
        'Stage',
        'Followers',
        'Growth %',
        'Engagement %',
        'Last contact',
        'Next follow up',
        'Email',
        'Phone',
        'Meals on Grain',
      ],
      chosen.map((r) => {
        const c = r.creator;
        const u = c.grain_user_id ? users.get(c.grain_user_id) : undefined;
        return [
          c.name,
          c.handle,
          c.platform
            ? (PLATFORM_LABEL[c.platform as Platform] ?? c.platform)
            : '',
          c.niche,
          c.city,
          c.country,
          STAGE_LABEL[c.stage],
          r.followers || '',
          r.growth == null ? '' : r.growth.toFixed(1),
          r.engagement ?? '',
          r.lastTouch,
          c.next_follow_up,
          c.email,
          c.phone,
          u ? u.meals_logged : '',
        ];
      }),
    );
    downloadFile(`grain_creators_${today}.csv`, csv);
  };

  const move = (to: number) => {
    const next = Math.max(0, Math.min(to, rows.length - 1));
    setCursor(next);
    const id = rows[next]?.creator.id;
    if (!id) return;
    document
      .getElementById(`crm-row-${id}`)
      ?.scrollIntoView({ block: 'nearest' });
    if (open && open !== 'new' && open !== 'import') onOpen(id);
  };

  // Keyboard: only when not typing, and never with a modifier held.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) {
        if (e.key === 'Escape') (e.target as HTMLElement).blur();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const row = rows[at];
      const key = e.key.toLowerCase();
      if (key === 'j' || e.key === 'ArrowDown') move(at + 1);
      else if (key === 'k' || e.key === 'ArrowUp') move(at - 1);
      else if (e.key === 'Enter' && row) onOpen(row.creator.id);
      else if (e.key === 'Escape') {
        if (help) setHelp(false);
        else if (open) onOpen(null);
        else if (checked.size) setChecked(new Set());
      } else if (e.key === '/') searchRef.current?.focus();
      else if (key === 'n') onOpen('new');
      else if (key === 'x' && row) {
        const next = new Set(checked);
        if (next.has(row.creator.id)) next.delete(row.creator.id);
        else next.add(row.creator.id);
        setChecked(next);
      } else if (/^[1-7]$/.test(e.key)) {
        patch(targets(row), { stage: STAGES[Number(e.key) - 1] });
      } else if (key === 't') {
        patch(targets(row), { next_follow_up: followUpDay(1, today) });
      } else if (key === 'w') {
        patch(targets(row), { next_follow_up: followUpDay(7, today) });
      } else if (e.key === '?') setHelp(!help);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const sortBy = (key: SortKey | null) => {
    if (!key) return;
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 1 ? -1 : 1 }
        : { key, dir: key === 'name' || key === 'stage' ? 1 : -1 },
    );
  };

  const allChecked =
    rows.length > 0 && rows.every((r) => checked.has(r.creator.id));

  return (
    <div>
      <div className={css.head}>
        <h1>Creators</h1>
        <div className={css.headActions}>
          <input
            ref={searchRef}
            className={css.search}
            placeholder="Search name, handle, niche, city    /"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
          />
          <button className={css.btn} onClick={() => onOpen('import')}>
            Import
          </button>
          <button className={css.btn} onClick={exportCsv}>
            Export CSV
          </button>
          <button
            className={cx(css.btn, css.primary)}
            onClick={() => onOpen('new')}
          >
            New creator <Kbd>N</Kbd>
          </button>
        </div>
      </div>

      <div className={cx(css.kpis, compactCols && css.kpisCompact)}>
        <Kpi
          label={compactCols ? 'Due today' : 'Follow ups due today'}
          value={stats.dueToday}
          hot={stats.dueToday > 0}
          onClick={() => setView('action')}
        />
        <Kpi
          label="Overdue"
          value={stats.overdue}
          hot={stats.overdue > 0}
          onClick={() => setView('action')}
        />
        <Kpi
          label={compactCols ? 'Your move' : 'Replied, nothing planned'}
          value={stats.repliedWaiting}
          hot={stats.repliedWaiting > 0}
          sub="They answered. Your move."
          onClick={() => setView('action')}
        />
        <Kpi
          label="Reply rate"
          value={
            stats.funnel.replyRate == null
              ? 'none'
              : `${Math.round(stats.funnel.replyRate * 100)}%`
          }
          sub={`${stats.funnel.replied} of ${stats.funnel.reached} contacted`}
          onClick={() => setView('all')}
        />
        <Kpi
          label="Roster"
          value={stats.funnel.onboarded}
          sub="onboarded, active, partners"
          onClick={() => setView('roster')}
        />
        <Kpi
          label={compactCols ? 'Reach' : 'Roster reach'}
          value={compact(stats.reach)}
          sub="followers across the roster"
          onClick={() => setView('roster')}
        />
      </div>

      <div className={css.toolbar}>
        {VIEWS.map((v) => (
          <button
            key={v.value}
            className={cx(css.viewTab, view === v.value && css.viewOn)}
            onClick={() => {
              setView(v.value);
              setCursor(0);
            }}
          >
            {v.label}
            <span className={css.viewCount}>{stats.views[v.value]}</span>
          </button>
        ))}
        {checked.size ? (
          <div className={css.bulk}>
            {checked.size} selected
            <select
              value=""
              onChange={(e) => {
                patch([...checked], { stage: e.target.value as Stage });
              }}
            >
              <option value="" hidden>
                Move to
              </option>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABEL[s]}
                </option>
              ))}
            </select>
            <select
              value=""
              onChange={(e) => {
                const f = FOLLOW_UPS[Number(e.target.value)];
                if (f)
                  patch([...checked], {
                    next_follow_up: followUpDay(f.days, today),
                  });
              }}
            >
              <option value="" hidden>
                Follow up
              </option>
              {FOLLOW_UPS.map((f, i) => (
                <option key={f.label} value={i}>
                  {f.label}
                </option>
              ))}
            </select>
            <button className={css.bulkBtn} onClick={exportCsv}>
              Export
            </button>
            <button
              className={css.bulkBtn}
              onClick={() => setChecked(new Set())}
            >
              Clear
            </button>
          </div>
        ) : (
          <>
            <select
              className={css.sortSelect}
              aria-label="Sort"
              value={
                SORTS.findIndex(
                  (s) => s.key === sort.key && s.dir === sort.dir,
                ) + ''
              }
              onChange={(e) => {
                const s = SORTS[Number(e.target.value)];
                if (s) setSort({ key: s.key, dir: s.dir });
              }}
            >
              <option value="-1" hidden>
                Sorted by column
              </option>
              {SORTS.map((s, i) => (
                <option key={s.label} value={i}>
                  Sort: {s.label}
                </option>
              ))}
            </select>
            <button className={css.hint} onClick={() => setHelp(true)}>
              Keyboard shortcuts <Kbd>?</Kbd>
            </button>
          </>
        )}
      </div>

      <div className={css.tableWrap}>
        {data == null ? (
          <div className={css.empty}>Loading creators</div>
        ) : rows.length === 0 ? (
          <div className={css.empty}>
            {all.length === 0
              ? 'No creators yet. Press N to add the first one you are reaching out to.'
              : view === 'action' && !q
                ? 'Nothing needs you right now. Every follow up is in the future.'
                : view === 'waiting' && !q
                  ? 'Nothing waiting. Links sent to the Telegram bot and imports land here.'
                  : 'No one matches.'}
          </div>
        ) : (
          <table className={cx(css.table, compactCols && css.compact)}>
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input
                    type="checkbox"
                    className={css.check}
                    checked={allChecked}
                    onChange={() =>
                      setChecked(
                        allChecked
                          ? new Set()
                          : new Set(rows.map((r) => r.creator.id)),
                      )
                    }
                    aria-label="Select all"
                  />
                </th>
                {COLUMNS.filter((c) => !compactCols || !c.wide).map((c) => (
                  <th
                    key={c.label}
                    className={cx(
                      c.num && css.num,
                      c.key && css.sortable,
                      sort.key === c.key && css.sortOn,
                      c.fit && css[c.fit],
                    )}
                    onClick={() => sortBy(c.key)}
                  >
                    {c.label}
                    {sort.key === c.key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const c = r.creator;
                const u = c.grain_user_id
                  ? users.get(c.grain_user_id)
                  : undefined;
                const premium =
                  u?.premium_source &&
                  (!u.premium_ends_at ||
                    new Date(u.premium_ends_at) > new Date());
                return (
                  <tr
                    key={c.id}
                    id={`crm-row-${c.id}`}
                    className={cx(
                      i === at && css.rowCursor,
                      checked.has(c.id) && css.rowChecked,
                      open === c.id && css.rowOpen,
                    )}
                    onClick={() => {
                      setCursor(i);
                      onOpen(c.id);
                    }}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className={css.check}
                        checked={checked.has(c.id)}
                        onChange={() => {
                          const next = new Set(checked);
                          if (next.has(c.id)) next.delete(c.id);
                          else next.add(c.id);
                          setChecked(next);
                        }}
                        aria-label={`Select ${c.name}`}
                      />
                    </td>
                    <td>
                      <span className={css.creatorCell}>
                        <span className={css.name}>{c.name}</span>
                        {c.platform && c.platform !== 'other' ? (
                          <span className={css.ptag}>
                            {c.platform === 'instagram'
                              ? 'IG'
                              : c.platform === 'youtube'
                                ? 'YT'
                                : 'X'}
                          </span>
                        ) : null}
                        {c.handle ? (
                          <span className={css.handle}>{c.handle}</span>
                        ) : null}
                      </span>
                    </td>
                    <td>
                      <StageSelect
                        value={c.stage}
                        onChange={(stage) => patch([c.id], { stage })}
                      />
                    </td>
                    {compactCols ? null : (
                      <>
                        <td className={cx(css.muted, css.fit2)}>
                          <span className={css.clip}>{c.niche}</span>
                        </td>
                        <td className={cx(css.muted, css.fit1)}>
                          <span className={css.clip}>{c.city}</span>
                        </td>
                      </>
                    )}
                    <td className={css.num}>
                      {r.followers ? compact(r.followers) : ''}
                    </td>
                    {compactCols ? null : (
                      <>
                        <td
                          className={cx(
                            css.num,
                            css.fit2,
                            r.growth != null && r.growth < 0 && css.down,
                          )}
                        >
                          {r.growth == null
                            ? ''
                            : `${r.growth >= 0 ? '↑' : '↓'} ${pct(Math.abs(r.growth))}`}
                        </td>
                        <td className={cx(css.num, css.fit1)}>
                          {pct(r.engagement)}
                        </td>
                      </>
                    )}
                    <td
                      className={r.lastTouch ? css.muted : css.faint}
                      title={r.lastTouch ? shortDate(r.lastTouch) : undefined}
                    >
                      {r.lastTouch ? relativeDay(r.lastTouch, today) : 'never'}
                    </td>
                    <td
                      title={
                        c.next_follow_up
                          ? shortDate(c.next_follow_up)
                          : undefined
                      }
                    >
                      <FollowSelect
                        value={c.next_follow_up}
                        today={today}
                        onChange={(next_follow_up) =>
                          patch([c.id], { next_follow_up })
                        }
                      />
                      {needsAction(c, today) && !c.next_follow_up ? (
                        <span className={css.badge}>reply</span>
                      ) : null}
                    </td>
                    {compactCols ? null : (
                      <td className={css.fit2}>
                        {u ? (
                          <>
                            <span className={css.muted}>
                              {u.meals_logged
                                ? `${u.meals_logged} meals`
                                : 'no meals yet'}
                            </span>
                            {premium ? (
                              <span className={css.badge}>Premium</span>
                            ) : null}
                          </>
                        ) : null}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {help ? (
        <div className={css.overlay} onClick={() => setHelp(false)}>
          <div className={css.sheet} onClick={(e) => e.stopPropagation()}>
            <h3>Keyboard shortcuts</h3>
            {SHORTCUTS.map(([keys, what]) => (
              <div key={keys} className={css.keyRow}>
                <span>{what}</span>
                <span className={css.muted}>{keys}</span>
              </div>
            ))}
            <p className={css.note}>
              Stage and follow up shortcuts change every selected row at once
              when rows are selected, otherwise the highlighted one.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  hot,
  onClick,
}: {
  label: string;
  value: number | string;
  sub?: string;
  hot?: boolean;
  onClick: () => void;
}) {
  return (
    <button className={cx(css.kpi, hot && css.kpiHot)} onClick={onClick}>
      <span className={css.kpiLabel}>{label}</span>
      <span className={css.kpiValue}>{value}</span>
      {sub ? <span className={css.kpiSub}>{sub}</span> : null}
    </button>
  );
}

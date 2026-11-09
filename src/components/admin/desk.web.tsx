/**
 * desk.web.tsx: the admin on a laptop. A sidebar and a full width
 * workspace: the creators table with a creator open beside it, the pipeline
 * board, the users table and the numbers. Data loads once and every view
 * shares it, so switching is instant.
 */

import { useState } from 'react';
import { router } from 'expo-router';

import { needsAction } from '@/lib/admin/crm';
import { todayKey } from '@/lib/log-store';

import { cx } from './crm/bits';
import { PipelineBoard } from './crm/board';
import css from './crm/crm.module.css';
import { CreatorPanel } from './crm/panel';
import { PeopleTable } from './crm/people';
import { useCrm } from './crm/state';
import { CreatorsTable } from './crm/table';
import type { DeskProps } from './desk';
import { StatsView } from './stats';

type Section = 'creators' | 'pipeline' | 'users' | 'stats';

const NAV: { value: Section; label: string }[] = [
  { value: 'creators', label: 'Creators' },
  { value: 'pipeline', label: 'Pipeline' },
  { value: 'users', label: 'Users' },
  { value: 'stats', label: 'Stats' },
];

export function AdminDesk({ adminId, email, paywall }: DeskProps) {
  const crm = useCrm();
  const [section, setSection] = useState<Section>('creators');
  const [open, setOpen] = useState<string | null>(null);
  const today = todayKey();
  const waiting = (crm.data?.creators ?? []).filter((c) =>
    needsAction(c, today),
  ).length;

  const withPanel = section === 'creators' || section === 'pipeline';

  return (
    <div className={css.app}>
      <aside className={css.side}>
        <div className={css.brand}>
          Grain<span>admin</span>
        </div>
        {NAV.map((n) => (
          <button
            key={n.value}
            className={cx(css.navItem, section === n.value && css.navOn)}
            onClick={() => setSection(n.value)}
          >
            {n.label}
            {n.value === 'creators' && waiting ? (
              <span className={cx(css.navCount, css.navHot)}>{waiting}</span>
            ) : n.value === 'pipeline' && crm.data ? (
              <span className={css.navCount}>{crm.data.creators.length}</span>
            ) : null}
          </button>
        ))}
        <div className={css.sideFoot}>
          <span>{email}</span>
          <button
            className={css.linkBtn}
            onClick={() => router.navigate('/profile')}
          >
            Back to the app
          </button>
        </div>
      </aside>

      <main className={css.main}>
        {crm.error ? (
          <div className={css.errorBar}>
            {crm.error}
            <button className={css.linkBtn} onClick={() => crm.setError(null)}>
              Dismiss
            </button>
          </div>
        ) : null}
        <div className={css.work}>
          <div className={css.workMain}>
            {section === 'creators' ? (
              <CreatorsTable crm={crm} open={open} onOpen={setOpen} />
            ) : section === 'pipeline' ? (
              <PipelineBoard crm={crm} open={open} onOpen={setOpen} />
            ) : section === 'users' ? (
              <PeopleTable adminId={adminId} paywall={paywall} />
            ) : (
              <div className={css.statsWrap}>
                <div className={css.head}>
                  <h1>Stats</h1>
                </div>
                <StatsView />
              </div>
            )}
          </div>
          {withPanel && open ? (
            <CreatorPanel
              key={open}
              crm={crm}
              id={open}
              adminId={adminId}
              onClose={() => setOpen(null)}
              onCreated={setOpen}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}

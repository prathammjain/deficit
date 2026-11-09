/**
 * board.tsx: the pipeline as columns, one per stage. Drag a card to move
 * someone along; click it to open them beside the board. Each column shows
 * how many people and how much reach sit in it.
 */

import { useMemo, useState } from 'react';

import { buildRows, sortRows } from '@/lib/admin/crm';
import { STAGES, STAGE_LABEL, compact, type Stage } from '@/lib/admin/format';
import { todayKey } from '@/lib/log-store';

import { cx, followText } from './bits';
import css from './crm.module.css';
import type { Crm } from './state';

export function PipelineBoard({
  crm,
  open,
  onOpen,
}: {
  crm: Crm;
  open: string | null;
  onOpen: (id: string) => void;
}) {
  const today = todayKey();
  const [showDeclined, setShowDeclined] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const data = crm.data;

  const rows = useMemo(
    () =>
      data
        ? sortRows(
            buildRows(data.creators, data.metrics, data.touches, today),
            'urgency',
            1,
          )
        : [],
    [data, today],
  );
  const stages = STAGES.filter((s) => showDeclined || s !== 'declined');

  const drop = (stage: Stage) => {
    const id = dragging;
    setDragging(null);
    setOver(null);
    const row = rows.find((r) => r.creator.id === id);
    if (row && row.creator.stage !== stage) {
      void crm.patchCreators([row.creator.id], { stage });
    }
  };

  return (
    <div>
      <div className={css.head}>
        <h1>Pipeline</h1>
        <div className={css.headActions}>
          <button
            className={css.btn}
            onClick={() => setShowDeclined(!showDeclined)}
          >
            {showDeclined ? 'Hide declined' : 'Show declined'}
          </button>
        </div>
      </div>
      {data == null ? (
        <div className={css.empty}>Loading the pipeline</div>
      ) : (
        <div className={css.board}>
          {stages.map((stage) => {
            const inStage = rows.filter((r) => r.creator.stage === stage);
            const reach = inStage.reduce((s, r) => s + r.followers, 0);
            return (
              <div
                key={stage}
                className={cx(css.col, over === stage && css.colOver)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (over !== stage) setOver(stage);
                }}
                onDragLeave={() => setOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  drop(stage);
                }}
              >
                <div className={css.colHead}>
                  {STAGE_LABEL[stage]}
                  <span>{inStage.length}</span>
                </div>
                <div className={css.colSub}>
                  {reach ? `${compact(reach)} reach` : ' '}
                </div>
                {inStage.length === 0 ? (
                  <div className={css.colEmpty}>Drag someone here</div>
                ) : null}
                {inStage.map((r) => {
                  const c = r.creator;
                  const hot =
                    c.next_follow_up != null && c.next_follow_up <= today;
                  return (
                    <button
                      key={c.id}
                      draggable
                      className={cx(
                        css.card,
                        dragging === c.id && css.cardDragging,
                      )}
                      style={
                        open === c.id ? { borderColor: '#F4511E' } : undefined
                      }
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', c.id);
                        e.dataTransfer.effectAllowed = 'move';
                        setDragging(c.id);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                      onClick={() => onOpen(c.id)}
                    >
                      <div className={css.cardName}>{c.name}</div>
                      <div className={css.cardMeta}>
                        {[c.handle, c.niche, c.city]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                      <div className={css.cardFoot}>
                        <span className={css.muted}>
                          {r.followers
                            ? `${compact(r.followers)} followers`
                            : ''}
                        </span>
                        <span className={hot ? css.hot : css.faint}>
                          {c.next_follow_up
                            ? followText(c.next_follow_up, today)
                            : ''}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

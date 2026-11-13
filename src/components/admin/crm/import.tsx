/**
 * import.tsx: adds creators from a WhatsApp chat in one go. Choose the
 * export (an iPhone's .zip or Android's .txt) or paste messages: every
 * profile link in it is listed, anyone already in the CRM is marked and left
 * unticked, and the chosen ones are added as prospects with the message they
 * came in. The chat is read in the browser and never uploaded.
 */

import { useRef, useState } from 'react';

import { chatText } from '@/lib/admin/chat-file';
import {
  SITE_LABEL,
  importRows,
  rowToCreator,
  scanChat,
  type ImportRow,
  type Scan,
} from '@/lib/admin/links';

import { cx } from './bits';
import css from './crm.module.css';
import type { Crm } from './state';

const newKeys = (rows: ImportRow[]) =>
  new Set(rows.filter((r) => !r.existing).map((r) => r.key));

export function ImportPanel({
  crm,
  onClose,
}: {
  crm: Crm;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [source, setSource] = useState<string | null>(null);
  const [found, setFound] = useState<{
    rows: ImportRow[];
    posts: Scan['posts'];
  } | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const read = (chat: string, from: string) => {
    const scan = scanChat(chat);
    const rows = importRows(scan, crm.data?.creators ?? []);
    setFound({ rows, posts: scan.posts });
    setChosen(newKeys(rows));
    setSource(from);
    setAdded(null);
    setProblem(null);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      read(await chatText(new Uint8Array(await file.arrayBuffer())), file.name);
    } catch {
      setProblem(
        'There’s no chat in that file. Choose the .zip or .txt WhatsApp made.',
      );
    }
    // The same file can be chosen again after an edit.
    if (fileRef.current) fileRef.current.value = '';
  };

  const add = async () => {
    if (!found || busy) return;
    const rows = found.rows.filter((r) => chosen.has(r.key)).map(rowToCreator);
    if (!rows.length) return;
    setBusy(true);
    const n = await crm.addCreators(rows);
    setBusy(false);
    if (n != null) {
      setAdded(n);
      setFound(null);
      setText('');
      setSource(null);
    }
  };

  const toggle = (key: string) =>
    setChosen((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const fresh = found ? newKeys(found.rows).size : 0;
  const already = (found?.rows.length ?? 0) - fresh;

  return (
    <aside className={css.panel}>
      <div className={css.panelHead}>
        <div>
          <h2>Import from WhatsApp</h2>
          <div className={css.panelSub}>
            In WhatsApp, open the chat and choose Export chat (on an iPhone, tap
            the chat’s name first), then Without media. Choose that file here,
            or paste messages. The chat is read on this page and never uploaded;
            only the creators you add are saved.
          </div>
        </div>
        <button className={css.close} onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      {added != null ? (
        <div className={css.importDone}>
          Added {added} {added === 1 ? 'creator' : 'creators'} as prospects, at
          the top of the table. The message each came in is in their notes.
        </div>
      ) : null}

      <div className={css.row}>
        <button
          className={cx(css.btn, css.primary)}
          onClick={() => fileRef.current?.click()}
        >
          Choose the export
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".zip,.txt,text/plain,application/zip"
          className={css.fileInput}
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        {source ? <span className={css.note}>{source}</span> : null}
      </div>
      <textarea
        className={css.input}
        rows={4}
        placeholder="Or paste messages or links"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {text.trim() ? (
        <button className={css.btn} onClick={() => read(text, 'Pasted text')}>
          Find profiles
        </button>
      ) : null}
      {problem ? <div className={css.hot}>{problem}</div> : null}

      {found ? (
        <div className={css.section}>
          <div className={css.sectionTitle}>
            <span>
              {found.rows.length
                ? `${found.rows.length} found · ${fresh} new`
                : 'No profile links found'}
            </span>
            {fresh ? (
              <button
                className={css.linkBtn}
                onClick={() =>
                  setChosen(chosen.size ? new Set() : newKeys(found.rows))
                }
              >
                {chosen.size ? 'Select none' : 'Select all new'}
              </button>
            ) : null}
          </div>
          {already ? (
            <div className={css.note}>
              {already} already in the CRM, so left unticked.
            </div>
          ) : null}
          <div className={css.importList}>
            {found.rows.map((r) => (
              <label key={r.key} className={css.importRow}>
                <input
                  type="checkbox"
                  className={css.check}
                  checked={chosen.has(r.key)}
                  onChange={() => toggle(r.key)}
                />
                <span className={css.importMain}>
                  <span className={css.importName}>
                    {r.handle}
                    {r.existing ? (
                      <span className={css.badge}>In CRM</span>
                    ) : null}
                  </span>
                  <span className={css.note}>
                    {[
                      r.profiles.map((p) => SITE_LABEL[p.site]).join(', '),
                      r.when,
                      r.mentions > 1 ? `shared ${r.mentions} times` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  {r.context ? (
                    <span className={css.importContext}>{r.context}</span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
          {found.rows.length ? (
            <button
              className={cx(css.btn, css.primary)}
              disabled={!chosen.size || busy}
              onClick={add}
            >
              {busy
                ? 'Adding'
                : `Add ${chosen.size} as ${chosen.size === 1 ? 'a prospect' : 'prospects'}`}
            </button>
          ) : null}
        </div>
      ) : null}

      {found?.posts.length ? (
        <div className={css.section}>
          <div className={css.sectionTitle}>
            <span>
              {found.posts.length} {found.posts.length === 1 ? 'link' : 'links'}{' '}
              without a handle
            </span>
          </div>
          <div className={css.note}>
            Reels, posts and videos don’t say whose they are. Open one to see
            the creator, then add them by hand.
          </div>
          {found.posts.map((p) => (
            <a
              key={p.url}
              className={css.importPost}
              href={p.url}
              target="_blank"
              rel="noreferrer"
            >
              {p.context || p.url}
            </a>
          ))}
        </div>
      ) : null}
    </aside>
  );
}

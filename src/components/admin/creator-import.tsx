/**
 * creator-import.tsx: the phone's import from a WhatsApp chat, reading it
 * the same way as the laptop's. Choose the export or paste messages, untick
 * anyone you don't want, and the rest are added as prospects. The chat is
 * read on the phone and never uploaded.
 */

import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { ChevronIcon } from '@/components/ui/icons';
import { Card, Hairline, PrimaryButton } from '@/components/ui/primitives';
import { palette, space, type as typo } from '@/constants/palette';
import { chatText } from '@/lib/admin/chat-file';
import {
  SITE_LABEL,
  importRows,
  rowToCreator,
  scanChat,
  type ImportRow,
  type Scan,
} from '@/lib/admin/links';
import { addCreators, type Creator } from '@/lib/supabase/admin';

import { ErrorLine, Field, QuietButton, message, ui } from './ui';

const newKeys = (rows: ImportRow[]) =>
  new Set(rows.filter((r) => !r.existing).map((r) => r.key));

export function CreatorImport({
  existing,
  onClose,
}: {
  existing: Creator[];
  onClose: (changed: boolean) => void;
}) {
  const [text, setText] = useState('');
  const [found, setFound] = useState<{
    rows: ImportRow[];
    posts: Scan['posts'];
  } | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const read = (chat: string) => {
    const scan = scanChat(chat);
    const rows = importRows(scan, existing);
    setFound({ rows, posts: scan.posts });
    setChosen(newKeys(rows));
    setAdded(null);
    setError(null);
  };

  // The phone's own file picker: Files on an iPhone, Downloads on Android.
  const choose = () => {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,.txt,text/plain,application/zip';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        read(await chatText(new Uint8Array(await file.arrayBuffer())));
      } catch {
        setError(
          'There’s no chat in that file. Choose the .zip or .txt WhatsApp made.',
        );
      }
    };
    input.click();
  };

  const add = async () => {
    if (!found || busy) return;
    const rows = found.rows.filter((r) => chosen.has(r.key)).map(rowToCreator);
    if (!rows.length) return;
    setBusy(true);
    try {
      setAdded((await addCreators(rows)).length);
      setFound(null);
      setText('');
    } catch (e) {
      setError(message(e));
    }
    setBusy(false);
  };

  const toggle = (key: string) =>
    setChosen((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const fresh = found ? newKeys(found.rows).size : 0;

  return (
    <View>
      <Pressable
        onPress={() => onClose(added != null)}
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

      <View style={{ marginTop: space.lg, gap: space.xs }}>
        <Text style={{ ...typo.heading, color: palette.text }}>
          Import from WhatsApp
        </Text>
        <Text style={ui.sub}>
          In WhatsApp, open the chat and choose Export chat (on an iPhone, tap
          the chat’s name first), then Without media. Choose that file here, or
          paste messages. The chat stays on your phone; only the creators you
          add are saved.
        </Text>
      </View>

      {added != null ? (
        <Card style={ui.card}>
          <Text style={ui.line}>
            Added {added} {added === 1 ? 'creator' : 'creators'} as prospects.
            The message each came in is in their notes.
          </Text>
        </Card>
      ) : null}

      <View style={{ marginTop: space.lg, gap: space.md }}>
        <PrimaryButton label="Choose the export" onPress={choose} />
        <Field
          placeholder="Or paste messages or links"
          value={text}
          onChangeText={setText}
          multiline
          autoCapitalize="none"
        />
        {text.trim() ? (
          <QuietButton label="Find profiles" onPress={() => read(text)} />
        ) : null}
        <ErrorLine text={error} />
      </View>

      {found ? (
        <Card style={ui.card}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={ui.cardTitle}>
              {found.rows.length
                ? `${found.rows.length} FOUND · ${fresh} NEW`
                : 'NO PROFILE LINKS FOUND'}
            </Text>
            {fresh ? (
              <Pressable
                onPress={() =>
                  setChosen(chosen.size ? new Set() : newKeys(found.rows))
                }
                hitSlop={8}
              >
                <Text style={ui.badge}>
                  {chosen.size ? 'Select none' : 'Select all new'}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {found.rows.map((r, i) => (
            <View key={r.key}>
              {i > 0 ? <Hairline /> : null}
              <Pressable onPress={() => toggle(r.key)} style={ui.row}>
                <View style={ui.rowText}>
                  <Text style={ui.rowTitle} numberOfLines={1}>
                    {r.handle}
                    {r.existing ? <Text style={ui.badge}> In CRM</Text> : null}
                  </Text>
                  <Text style={ui.sub} numberOfLines={1}>
                    {[
                      r.profiles.map((p) => SITE_LABEL[p.site]).join(', '),
                      r.when,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  {r.context ? (
                    <Text style={ui.sub} numberOfLines={2}>
                      {r.context}
                    </Text>
                  ) : null}
                </View>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    borderWidth: 1.5,
                    borderColor: chosen.has(r.key)
                      ? palette.text
                      : palette.hairline,
                    backgroundColor: chosen.has(r.key)
                      ? palette.text
                      : 'transparent',
                  }}
                  accessibilityLabel={
                    chosen.has(r.key) ? 'Selected' : 'Not selected'
                  }
                />
              </Pressable>
            </View>
          ))}
          {found.rows.length ? (
            <PrimaryButton
              label={
                busy
                  ? 'Adding'
                  : `Add ${chosen.size} as ${chosen.size === 1 ? 'a prospect' : 'prospects'}`
              }
              onPress={add}
              disabled={!chosen.size || busy}
            />
          ) : null}
        </Card>
      ) : null}

      {found?.posts.length ? (
        <Card style={ui.card}>
          <Text style={ui.cardTitle}>
            {found.posts.length} {found.posts.length === 1 ? 'LINK' : 'LINKS'}{' '}
            WITHOUT A HANDLE
          </Text>
          <Text style={ui.sub}>
            Reels, posts and videos don’t say whose they are. Open one to see
            the creator, then add them by hand.
          </Text>
          {found.posts.map((p) => (
            <Pressable
              key={p.url}
              onPress={() => {
                if (Platform.OS === 'web') window.open(p.url, '_blank');
              }}
            >
              <Text style={ui.line} numberOfLines={1}>
                {p.context || p.url}
              </Text>
            </Pressable>
          ))}
        </Card>
      ) : null}
    </View>
  );
}

/**
 * creators.tsx: the CRM list. Follow ups that are due sit on top; stages
 * filter the rest. Tapping a creator opens their page.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, Hairline, PrimaryButton } from '@/components/ui/primitives';
import {
  STAGES,
  STAGE_LABEL,
  compact,
  followUp,
  totalFollowers,
  type MetricRow,
  type Stage,
} from '@/lib/admin/format';
import { shortDate } from '@/lib/date';
import { todayKey } from '@/lib/log-store';
import { listCreators, listMetrics, type Creator } from '@/lib/supabase/admin';

import { CreatorPage } from './creator';
import { CreatorImport } from './creator-import';
import {
  Chips,
  ErrorLine,
  Field,
  Loading,
  QuietButton,
  message,
  ui,
} from './ui';

export function CreatorsView({ adminId }: { adminId: string }) {
  const [creators, setCreators] = useState<Creator[] | null>(null);
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [stage, setStage] = useState<Stage | 'all'>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Creator | 'new' | 'import' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      Promise.all([listCreators(), listMetrics()]).then(
        ([c, m]) => {
          setCreators(c);
          setMetrics(m);
          setError(null);
        },
        (e) => setError(message(e)),
      ),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  const today = todayKey();
  const followersOf = useMemo(() => {
    const by = new Map<string, MetricRow[]>();
    for (const m of metrics) {
      by.set(m.creator_id, [...(by.get(m.creator_id) ?? []), m]);
    }
    return (id: string) => by.get(id) ?? [];
  }, [metrics]);

  if (open === 'import') {
    return (
      <CreatorImport
        existing={creators ?? []}
        onClose={(changed) => {
          setOpen(null);
          if (changed) void load();
        }}
      />
    );
  }

  if (open) {
    return (
      <CreatorPage
        creator={open === 'new' ? null : open}
        metrics={open === 'new' ? [] : followersOf(open.id)}
        adminId={adminId}
        onClose={(changed) => {
          setOpen(null);
          if (changed) void load();
        }}
      />
    );
  }

  if (!creators) return error ? <ErrorLine text={error} /> : <Loading />;

  const counts = new Map<Stage, number>();
  for (const c of creators) counts.set(c.stage, (counts.get(c.stage) ?? 0) + 1);
  const q = query.trim().toLowerCase();
  const matches = (c: Creator) =>
    !q ||
    [c.name, c.handle, c.niche, c.city]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(q));
  const due = creators
    .filter((c) => {
      const f = followUp(c.next_follow_up, today);
      return f === 'overdue' || f === 'today';
    })
    .sort((a, b) => a.next_follow_up!.localeCompare(b.next_follow_up!));
  const shown = creators.filter(
    (c) => (stage === 'all' || c.stage === stage) && matches(c),
  );

  return (
    <View>
      <PrimaryButton
        label="Add creator"
        onPress={() => setOpen('new')}
        style={{ marginTop: 16 }}
      />
      <QuietButton
        label="Import from WhatsApp"
        onPress={() => setOpen('import')}
        style={{ marginTop: 10 }}
      />
      <ErrorLine text={error} />

      {due.length ? (
        <Card style={ui.card}>
          <Text style={ui.cardTitle}>FOLLOW UP</Text>
          {due.map((c) => (
            <Pressable key={c.id} onPress={() => setOpen(c)} style={ui.row}>
              <View style={ui.rowText}>
                <Text style={ui.rowTitle}>{c.name}</Text>
                <Text style={ui.sub}>
                  {STAGE_LABEL[c.stage]} ·{' '}
                  {followUp(c.next_follow_up, today) === 'today'
                    ? 'due today'
                    : `was due ${shortDate(c.next_follow_up!)}`}
                </Text>
              </View>
            </Pressable>
          ))}
        </Card>
      ) : null}

      <View style={{ marginTop: 24, gap: 12 }}>
        <Chips
          options={[
            { value: 'all' as const, label: `All ${creators.length}` },
            ...STAGES.filter((s) => counts.get(s)).map((s) => ({
              value: s,
              label: `${STAGE_LABEL[s]} ${counts.get(s)}`,
            })),
          ]}
          value={stage}
          onChange={setStage}
        />
        <Field
          placeholder="Search name, handle, niche or city"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
      </View>

      <Card padded={false} style={{ marginTop: 12 }}>
        {shown.length === 0 ? (
          <Text style={[ui.sub, { padding: 24 }]}>
            {creators.length
              ? 'No one matches.'
              : 'No creators yet. Add the first one you are reaching out to.'}
          </Text>
        ) : null}
        {shown.map((c, i) => {
          const followers = totalFollowers(followersOf(c.id));
          const f = followUp(c.next_follow_up, today);
          return (
            <View key={c.id}>
              {i > 0 ? <Hairline style={{ marginHorizontal: 24 }} /> : null}
              <Pressable
                onPress={() => setOpen(c)}
                style={[ui.row, { paddingHorizontal: 24 }]}
              >
                <View style={ui.rowText}>
                  <Text style={ui.rowTitle} numberOfLines={1}>
                    {c.name}
                    {c.handle ? <Text style={ui.sub}> {c.handle}</Text> : null}
                  </Text>
                  <Text style={ui.sub} numberOfLines={1}>
                    {[STAGE_LABEL[c.stage], c.niche, c.city]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Text style={ui.rowTitle}>
                    {followers ? compact(followers) : ''}
                  </Text>
                  {f === 'overdue' || f === 'today' ? (
                    <Text style={ui.badge}>Follow up</Text>
                  ) : null}
                </View>
              </Pressable>
            </View>
          );
        })}
      </Card>
    </View>
  );
}

/**
 * users.tsx: everyone with an account, the paywall switch, and gifting
 * premium by hand. Shows account details and activity counts, never meals.
 */

import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, Hairline, PrimaryButton } from '@/components/ui/primitives';
import { GIFT_LENGTHS, giftEndsAt } from '@/lib/admin/format';
import { shortDate } from '@/lib/date';
import {
  fetchUsers,
  giftPremium,
  removeGift,
  setPaywall,
  type AdminUser,
} from '@/lib/supabase/admin';

import {
  Chips,
  ErrorLine,
  Field,
  Loading,
  QuietButton,
  message,
  ui,
} from './ui';

export function UsersView({
  adminId,
  paywall: initialPaywall,
}: {
  adminId: string;
  paywall: boolean;
}) {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [paywall, setPaywallOn] = useState(initialPaywall);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    try {
      setUsers(await fetchUsers(q));
      setError(null);
    } catch (e) {
      setError(message(e));
    }
  }, []);

  // Search as you type, once typing pauses.
  useEffect(() => {
    const timer = setTimeout(() => load(search), 300);
    return () => clearTimeout(timer);
  }, [search, load]);

  const togglePaywall = async () => {
    setSaving(true);
    try {
      await setPaywall(!paywall);
      setPaywallOn(!paywall);
      setError(null);
    } catch (e) {
      setError(message(e));
    }
    setSaving(false);
  };

  return (
    <View>
      <Card style={ui.card}>
        <Pressable
          onPress={togglePaywall}
          disabled={saving}
          accessibilityRole="switch"
          accessibilityState={{ checked: paywall }}
          style={ui.row}
        >
          <View style={ui.rowText}>
            <Text style={ui.rowTitle}>Paywall</Text>
            <Text style={ui.sub}>
              {paywall
                ? 'On. Premium features need a gift or a subscription.'
                : 'Off. Everyone gets every feature.'}
            </Text>
          </View>
          <Text style={[ui.rowTitle, paywall && ui.badge]}>
            {paywall ? 'On' : 'Off'}
          </Text>
        </Pressable>
        <Text style={ui.caption}>
          Keep it off until the price is set and payments work. Gifts count
          either way.
        </Text>
      </Card>

      <Field
        style={{ marginTop: 24 }}
        placeholder="Search by email"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
        inputMode="email"
      />
      <ErrorLine text={error} />

      {users == null ? (
        <Loading />
      ) : (
        <Card padded={false} style={{ marginTop: 12 }}>
          {users.length === 0 ? (
            <Text style={[ui.sub, { padding: 24 }]}>No one matches.</Text>
          ) : null}
          {users.map((u, i) => (
            <View key={u.user_id}>
              {i > 0 ? <Hairline style={{ marginHorizontal: 24 }} /> : null}
              <View style={{ paddingHorizontal: 24 }}>
                <Pressable
                  onPress={() => setOpen(open === u.user_id ? null : u.user_id)}
                  style={ui.row}
                >
                  <View style={ui.rowText}>
                    <Text style={ui.rowTitle} numberOfLines={1}>
                      {u.email}
                    </Text>
                    <Text style={ui.sub}>{activity(u)}</Text>
                  </View>
                  <Text style={ui.badge}>{badge(u)}</Text>
                </Pressable>
                {open === u.user_id ? (
                  <View style={{ paddingBottom: 16 }}>
                    <PremiumControls
                      user={u}
                      adminId={adminId}
                      onChanged={() => load(search)}
                    />
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

function activity(u: AdminUser): string {
  const parts = [`Joined ${shortDate(u.joined_at)}`];
  if (u.last_active_at) parts.push(`active ${shortDate(u.last_active_at)}`);
  parts.push(
    u.meals_logged
      ? `${u.meals_logged} meals over ${u.days_logged} days`
      : 'no meals yet',
  );
  return parts.join(' · ');
}

const isLive = (endsAt: string | null) =>
  endsAt == null || new Date(endsAt) > new Date();

function badge(u: AdminUser): string {
  if (!u.premium_source || !isLive(u.premium_ends_at)) return '';
  return u.premium_source === 'gift' ? 'Gift' : 'Paid';
}

/**
 * Gift or remove premium for one user. Also used on a creator's page once
 * their Grain account is linked.
 */
export function PremiumControls({
  user,
  adminId,
  onChanged,
}: {
  user: Pick<AdminUser, 'user_id' | 'premium_source' | 'premium_ends_at'>;
  adminId: string;
  onChanged: () => void;
}) {
  const [months, setMonths] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      setError(null);
      onChanged();
    } catch (e) {
      setError(message(e));
    }
    setBusy(false);
  };

  const live = user.premium_source != null && isLive(user.premium_ends_at);
  const until = user.premium_ends_at
    ? `until ${shortDate(user.premium_ends_at)}`
    : 'no end date';

  if (live && user.premium_source === 'subscription') {
    return <Text style={ui.line}>Paid subscription, {until}.</Text>;
  }

  if (live) {
    return (
      <View style={{ gap: 12 }}>
        <Text style={ui.line}>Premium gifted, {until}.</Text>
        <QuietButton
          label={busy ? 'Removing' : 'Remove the gift'}
          disabled={busy}
          onPress={() => run(() => removeGift(user.user_id))}
        />
        <ErrorLine text={error} />
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {user.premium_source === 'gift' && user.premium_ends_at ? (
        <Text style={ui.sub}>
          A gift ended {shortDate(user.premium_ends_at)}.
        </Text>
      ) : null}
      <Chips
        options={GIFT_LENGTHS.map((g) => ({ value: g.months, label: g.label }))}
        value={months}
        onChange={setMonths}
      />
      <Field
        placeholder="Note, e.g. founding athlete"
        value={note}
        onChangeText={setNote}
      />
      <PrimaryButton
        label={busy ? 'Gifting' : 'Gift premium'}
        disabled={busy}
        onPress={() =>
          run(() =>
            giftPremium(user.user_id, giftEndsAt(months), note, adminId),
          )
        }
      />
      <ErrorLine text={error} />
    </View>
  );
}

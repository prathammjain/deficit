/**
 * admin.tsx: Grain's back office. The creator CRM, users with premium gifts
 * and the paywall switch, and the business numbers. Only admins see any of
 * it; the database enforces that, this screen only says so.
 */

import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { CreatorsView } from '@/components/admin/creators';
import { StatsView } from '@/components/admin/stats';
import { Loading, TextTabs, ui } from '@/components/admin/ui';
import { UsersView } from '@/components/admin/users';
import { ChevronIcon } from '@/components/ui/icons';
import { Card, Screen, Title } from '@/components/ui/primitives';
import { palette, space } from '@/constants/palette';
import type { Access } from '@/lib/access';
import { fetchAccess } from '@/lib/supabase/access';
import { useAuth } from '@/lib/supabase/auth';

type Section = 'creators' | 'users' | 'stats';

const SECTIONS: { value: Section; label: string }[] = [
  { value: 'creators', label: 'Creators' },
  { value: 'users', label: 'Users' },
  { value: 'stats', label: 'Stats' },
];

export default function AdminScreen() {
  const { session } = useAuth();
  // Undefined while asking the database.
  const [access, setAccess] = useState<Access | null | undefined>(undefined);
  const [section, setSection] = useState<Section>('creators');

  useEffect(() => {
    fetchAccess().then(setAccess);
  }, []);

  const adminId = session?.user?.id;

  return (
    <Screen>
      {/* Back means Profile, where this opens from. router.back() inside the
          tabs would land on Home. */}
      <Pressable
        onPress={() => router.navigate('/profile')}
        hitSlop={10}
        style={{
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          marginLeft: -4,
          marginBottom: space.md,
        }}
      >
        <ChevronIcon color={palette.textMuted} />
        <Text
          style={{ color: palette.textMuted, fontSize: 15, fontWeight: '600' }}
        >
          Back
        </Text>
      </Pressable>
      <Title>Admin</Title>

      {/* When access can't be shown, say exactly why, so setup is easy to
          finish: the SQL not run yet, or this account not marked admin. */}
      {access === undefined ? (
        <Loading />
      ) : access === null ? (
        <Card style={ui.card}>
          <Text style={ui.line}>Couldn&apos;t check admin access.</Text>
          <Text style={ui.sub}>
            If the admin tables aren&apos;t in Supabase yet, run
            supabase/schema.sql in the SQL editor (SETUP.md, step 5), then
            reload this page.
          </Text>
        </Card>
      ) : !access.admin || !adminId ? (
        <Card style={ui.card}>
          <Text style={ui.line}>This page is for Grain&apos;s admins.</Text>
          <Text style={ui.sub}>
            Signed in as {session?.user?.email ?? 'an account with no email'},
            which isn&apos;t an admin. To make it one, run the insert in
            SETUP.md, step 5, with this exact email, then reload.
          </Text>
        </Card>
      ) : (
        <>
          <TextTabs options={SECTIONS} value={section} onChange={setSection} />
          {section === 'creators' ? <CreatorsView adminId={adminId} /> : null}
          {section === 'users' ? (
            <UsersView adminId={adminId} paywall={access.paywall} />
          ) : null}
          {section === 'stats' ? <StatsView /> : null}
        </>
      )}
    </Screen>
  );
}

/**
 * stats.tsx: the business numbers. People, who is logging, activation,
 * second week retention, the engine and premium. Reloads every minute while
 * open. Aggregates only: no one's meals are ever shown here.
 */

import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { BarChart } from '@/components/charts';
import { Card } from '@/components/ui/primitives';
import { palette } from '@/constants/palette';
import { share } from '@/lib/admin/format';
import { fetchStats, type AdminStats } from '@/lib/supabase/admin';

import { ErrorLine, Loading, Stat, message, ui } from './ui';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function StatsView() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [at, setAt] = useState<Date | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchStats().then(
        (s) => {
          if (!alive) return;
          setStats(s);
          setError(null);
          setAt(new Date());
        },
        (e) => alive && setError(message(e)),
      );
    load();
    const timer = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (!stats) return error ? <ErrorLine text={error} /> : <Loading />;
  const s = stats;
  const e = s.engine;

  return (
    <View>
      <Text style={[ui.caption, { marginTop: 16 }]}>
        Updated{' '}
        {at?.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
        })}
        , every minute while this is open. Days in India time.
      </Text>
      <ErrorLine text={error} />

      <Card style={ui.card}>
        <Text style={ui.cardTitle}>PEOPLE</Text>
        <Text style={ui.big}>{s.users.total.toLocaleString()}</Text>
        <View style={ui.statRow}>
          <Stat label="New today" value={s.users.today} />
          <Stat label="7 days" value={s.users.week} />
          <Stat label="30 days" value={s.users.month} />
        </View>
        <BarChart values={s.signups_by_day} height={64} />
        <Text style={ui.caption}>Signups a day, last 30 days</Text>
      </Card>

      <Card style={ui.card}>
        <Text style={ui.cardTitle}>LOGGING</Text>
        <View style={ui.statRow}>
          <Stat label="Today" value={s.loggers.today} />
          <Stat label="7 days" value={s.loggers.week} />
          <Stat label="30 days" value={s.loggers.month} />
        </View>
        <BarChart values={s.loggers_by_day} height={64} />
        <Text style={ui.caption}>People who logged a meal, each day</Text>
        <Text style={ui.line}>
          {sum(s.meals_by_day).toLocaleString()} meals logged in 30 days
        </Text>
        <BarChart
          values={s.meals_by_day}
          height={64}
          positiveColor={palette.textMuted}
        />
        <Text style={ui.caption}>Meals a day</Text>
      </Card>

      <Card style={ui.card}>
        <Text style={ui.cardTitle}>STICKING</Text>
        <Text style={ui.line}>
          Activation: {share(s.activation.logged, s.activation.joined)}
        </Text>
        <Text style={ui.sub}>
          Of everyone who joined in the last 30 days, how many logged a meal.
        </Text>
        <Text style={ui.line}>
          Second week: {share(s.retention.returned, s.retention.joined)}
        </Text>
        <Text style={ui.sub}>
          Of everyone who joined 2 to 4 weeks ago, how many logged again in
          their second week.
        </Text>
      </Card>

      <Card style={ui.card}>
        <Text style={ui.cardTitle}>ENGINE, LAST 7 DAYS</Text>
        <View style={ui.statRow}>
          <Stat label="Described meals" value={e.week_runs} />
          <Stat
            label="Median time"
            value={
              e.week_median_ms != null
                ? `${(e.week_median_ms / 1000).toFixed(1)} s`
                : 'none'
            }
          />
        </View>
        <Text style={ui.line}>
          Degraded: {share(e.week_degraded, e.week_runs)}
        </Text>
        <Text style={ui.line}>
          From cache: {share(e.week_cached, e.week_runs)}
        </Text>
        <BarChart values={e.runs_by_day} height={64} />
        <Text style={ui.caption}>Described meals a day, last 30 days</Text>
      </Card>

      <Card style={ui.card}>
        <Text style={ui.cardTitle}>PREMIUM</Text>
        <View style={ui.statRow}>
          <Stat label="Paywall" value={s.premium.paywall ? 'On' : 'Off'} />
          <Stat label="Gifted" value={s.premium.gifted} />
          <Stat label="Paid" value={s.premium.paid} />
        </View>
      </Card>
    </View>
  );
}

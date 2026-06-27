import { Text, View } from 'react-native';

import { Card } from '@/components/ui/primitives';
import { palette } from '@/constants/palette';
import {
  dayDeficit,
  type DayRecord,
  type HistoryTargets,
} from '@/lib/history-stats';

import { st } from './styles';

/** The per-day record as a sleek in-app list (newest first), not a CSV dump. */
export function DayByDay({
  records,
  targets,
}: {
  records: DayRecord[];
  targets: HistoryTargets;
}) {
  const logged = records.filter((d) => d.logged).reverse();
  if (logged.length === 0) return null;
  return (
    <Card padded={false} style={st.dayCard}>
      {logged.map((rec, i) => (
        <DayRow key={rec.date} rec={rec} targets={targets} first={i === 0} />
      ))}
    </Card>
  );
}

function DayRow({
  rec,
  targets,
  first,
}: {
  rec: DayRecord;
  targets: HistoryTargets;
  first: boolean;
}) {
  const def = dayDeficit(rec, targets); // maintenance − intake
  const over = rec.kcal > targets.targetKcal;
  const fillPct = Math.min(100, (rec.kcal / targets.targetKcal) * 100);
  const { weekday, day, month } = formatDay(rec.date);

  return (
    <View style={[st.dayRow, !first && st.dayRowBorder]}>
      <View style={st.dayDate}>
        <Text style={st.dayNum}>{day}</Text>
        <Text style={st.dayMon}>{month}</Text>
      </View>

      <View style={st.dayMain}>
        <View style={st.dayTopLine}>
          <Text style={st.dayWeekday}>{weekday}</Text>
          <Text style={st.dayKcal}>
            {rec.kcal.toLocaleString()}
            <Text style={st.dayKcalUnit}> kcal</Text>
          </Text>
        </View>
        <View style={st.dayBarTrack}>
          <View
            style={[
              st.dayBarFill,
              {
                width: `${fillPct}%`,
                backgroundColor: over ? palette.danger : palette.accent,
              },
            ]}
          />
        </View>
        <Text style={st.dayMacros}>
          P{rec.proteinG} · C{rec.carbsG} · F{rec.fatG}
          {rec.weightKg != null ? `   ·   ${rec.weightKg} kg` : ''}
        </Text>
      </View>

      <View style={st.dayRight}>
        <Text
          style={[
            st.dayDeficit,
            { color: def >= 0 ? palette.good : palette.danger },
          ]}
        >
          {def >= 0 ? '+' : ''}
          {def.toLocaleString()}
        </Text>
        <Text style={st.dayDeficitLabel}>deficit</Text>
      </View>
    </View>
  );
}

/** YYYY-MM-DD → { weekday: 'Thu', day: '19', month: 'Jun' } in local time. */
function formatDay(date: string): {
  weekday: string;
  day: string;
  month: string;
} {
  const d = new Date(`${date}T00:00:00`);
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    day: String(d.getDate()),
    month: d.toLocaleDateString('en-US', { month: 'short' }),
  };
}

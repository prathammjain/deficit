/**
 * week-share.tsx — the weekly card at the top of History: the image itself as
 * the preview, and one button to share it.
 */

import { useEffect, useState } from 'react';
import { Image, Platform, View } from 'react-native';

import { PrimaryButton, SectionLabel } from '@/components/ui/primitives';
import type { DayRecord, HistoryTargets } from '@/lib/history-stats';
import { drawWeekCard, shareWeekCard } from '@/lib/week-card';
import { weekReport, type WeekReport } from '@/lib/week-report';

import { st } from './styles';

export function WeekShare({
  records,
  targets,
}: {
  records: DayRecord[];
  targets: HistoryTargets;
}) {
  const report = weekReport(records, targets);
  const key = JSON.stringify(report);
  const [card, setCard] = useState<{ blob: Blob; url: string } | null>(null);

  // Drawn ahead of the tap: the share sheet only opens straight from a tap,
  // with no waiting in between.
  useEffect(() => {
    const r = JSON.parse(key) as WeekReport;
    if (Platform.OS !== 'web' || r.daysLogged === 0) return;
    let url: string | null = null;
    let alive = true;
    drawWeekCard(r)
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setCard({ blob, url });
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
    // Keyed on the numbers, so the card redraws only when one changes.
  }, [key]);

  if (Platform.OS !== 'web' || report.daysLogged === 0 || !card) return null;

  return (
    <View style={st.weekShare}>
      <SectionLabel style={st.weekLabel}>Your week</SectionLabel>
      <Image source={{ uri: card.url }} style={st.weekImage} />
      <PrimaryButton
        label="Share your week"
        onPress={() =>
          void shareWeekCard(card.blob, `grain-week-${report.to}.png`)
        }
      />
    </View>
  );
}

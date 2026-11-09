/**
 * rest.tsx: the rest timer. It starts itself when a set is ticked and sits
 * at the bottom of the logger, out of the way of the next set.
 */

import { Pressable, Text, View } from 'react-native';

import { MinusIcon, PlusIcon } from '@/components/ui/icons';
import {
  DotMatrix,
  GlassSurface,
  ProgressBar,
} from '@/components/ui/primitives';
import { palette, shadow } from '@/constants/palette';
import { clock } from '@/lib/train/workout';

import { tr } from './styles';

export function RestBar({
  rest,
  now,
  onAdjust,
  onClose,
}: {
  rest: { endsAt: number; total: number };
  now: number;
  onAdjust: (sec: number) => void;
  onClose: () => void;
}) {
  const left = rest.endsAt - now;
  const over = left <= 0;
  const fraction = over ? 1 : 1 - left / rest.total;
  return (
    <View style={tr.restWrap} pointerEvents="box-none">
      <GlassSurface style={[tr.restBar, shadow.soft]}>
        <View style={tr.restTop}>
          <View style={tr.flex1} accessibilityLiveRegion="polite">
            <Text style={over ? tr.eyebrow : tr.eyebrowAccent}>
              {over ? 'REST OVER' : 'REST'}
            </Text>
            <DotMatrix style={[tr.restTime, over && tr.restTimeDone]}>
              {/* Round up, so a 90 second rest starts at 1:30. */}
              {clock(over ? 0 : left + 999)}
            </DotMatrix>
          </View>
          {over ? null : (
            <>
              <Pressable
                onPress={() => onAdjust(-15)}
                accessibilityLabel="15 seconds less"
                style={({ pressed }) => [tr.restBtn, pressed && tr.pressed]}
              >
                <MinusIcon size={11} />
                <Text style={tr.restBtnText}>15</Text>
              </Pressable>
              <Pressable
                onPress={() => onAdjust(15)}
                accessibilityLabel="15 seconds more"
                style={({ pressed }) => [tr.restBtn, pressed && tr.pressed]}
              >
                <PlusIcon size={11} />
                <Text style={tr.restBtnText}>15</Text>
              </Pressable>
            </>
          )}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [tr.restBtn, pressed && tr.pressed]}
          >
            <Text style={tr.restBtnText}>{over ? 'Close' : 'Skip'}</Text>
          </Pressable>
        </View>
        <ProgressBar
          fraction={fraction}
          fillColor={over ? palette.text : palette.accent}
        />
      </GlassSurface>
    </View>
  );
}

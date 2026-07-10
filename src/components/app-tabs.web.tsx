import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, View, StyleSheet, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { GlassSurface } from '@/components/ui/primitives';
import { palette, radius, shadow, space } from '@/constants/palette';

/** Muted icon/label color on the warm-white bar. */
const INACTIVE = palette.textFaint;

/** One consistent thin-stroke icon language (matches the ArcGauge weight). */
type IconProps = { color: string };

function HomeIcon({ color }: IconProps) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4.5 10.2 12 4.2l7.5 6v8.8a1 1 0 0 1-1 1h-4.6v-5.6H10v5.6H5.5a1 1 0 0 1-1-1v-8.8Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function LogIcon({ color }: IconProps) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 6.5h14M5 12h14M5 17.5h8"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function HistoryIcon({ color }: IconProps) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 17.5 9.2 12l3.8 3.2 7-7.7"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList asChild>
        <BottomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton icon={HomeIcon} label="Home" />
          </TabTrigger>
          <TabTrigger name="log" href="/log" asChild>
            <TabButton icon={LogIcon} label="Log" />
          </TabTrigger>
          <TabTrigger name="history" href="/history" asChild>
            <TabButton icon={HistoryIcon} label="History" />
          </TabTrigger>
          {/* Registered so router.push('/profile') works; no visible tab. */}
          <TabTrigger
            name="profile"
            href="/profile"
            style={styles.hiddenTrigger}
          />
        </BottomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({
  icon: Icon,
  label,
  isFocused,
  ...props
}: TabTriggerSlotProps & {
  icon: (p: IconProps) => React.JSX.Element;
  label: string;
}) {
  return (
    <Pressable
      {...props}
      style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}
    >
      <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
        <Icon color={isFocused ? palette.accentText : INACTIVE} />
      </View>
      <Text
        style={[
          styles.tabLabel,
          { color: isFocused ? palette.accent : INACTIVE },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function BottomTabList(props: TabListProps) {
  return (
    <View style={styles.tabBarOuter} pointerEvents="box-none">
      <GlassSurface dark style={styles.tabBar}>
        <View {...props} style={styles.tabRow}>
          {props.children}
        </View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarOuter: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.lg,
    alignItems: 'center',
  },
  tabBar: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.xl,
    ...shadow.raised,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.xs,
    gap: 3,
  },
  iconWrap: {
    paddingHorizontal: space.lg,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  iconWrapActive: { backgroundColor: palette.accent },
  tabLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  hiddenTrigger: { display: 'none' },
  pressed: { opacity: 0.6 },
});

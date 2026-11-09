import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { usePathname } from 'expo-router';
import {
  Pressable,
  View,
  StyleSheet,
  Text,
  useWindowDimensions,
} from 'react-native';
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

function TrainIcon({ color }: IconProps) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 7.5v9M17 7.5v9M4 10v4M20 10v4M7 12h10"
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
          <TabTrigger name="train" href="/train" asChild>
            <TabButton icon={TrainIcon} label="Train" />
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
          {/* Same for the admin screen, opened from Profile by admins. */}
          <TabTrigger name="admin" href="/admin" style={styles.hiddenTrigger} />
          {/* The logger and an exercise's page, opened from Train. */}
          <TabTrigger
            name="workout"
            href="/workout"
            style={styles.hiddenTrigger}
          />
          <TabTrigger
            name="exercise"
            href="/exercise"
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
      <Icon color={isFocused ? palette.text : INACTIVE} />
      <Text
        style={[
          styles.tabLabel,
          { color: isFocused ? palette.text : INACTIVE },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function BottomTabList(props: TabListProps) {
  // The laptop admin is a full screen workspace with its own sidebar, and
  // the workout logger needs the bottom of the screen for its rest timer,
  // so the bar steps aside there. The triggers stay mounted for routing.
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const hidden =
    (pathname.startsWith('/admin') && width >= 1024) ||
    pathname.startsWith('/workout');
  return (
    <View
      style={[styles.tabBarOuter, hidden && styles.hiddenTrigger]}
      pointerEvents="box-none"
    >
      <GlassSurface style={styles.tabBar}>
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
    ...shadow.soft,
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
    paddingVertical: space.sm,
    gap: 4,
  },
  tabLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
  hiddenTrigger: { display: 'none' },
  pressed: { opacity: 0.6 },
});

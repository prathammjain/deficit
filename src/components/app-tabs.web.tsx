import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, View, StyleSheet, Text } from 'react-native';

import { GlassSurface } from '@/components/ui/primitives';
import { palette, radius, shadow, space } from '@/constants/palette';

/** Muted icon/label color on the dark glass bar. */
const ON_DARK = 'rgba(255,255,255,0.55)';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList asChild>
        <BottomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton icon="⌂" label="Home" />
          </TabTrigger>
          <TabTrigger name="log" href="/log" asChild>
            <TabButton icon="✎" label="Log" />
          </TabTrigger>
          <TabTrigger name="history" href="/history" asChild>
            <TabButton icon="↗" label="History" />
          </TabTrigger>
        </BottomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({
  icon,
  label,
  isFocused,
  ...props
}: TabTriggerSlotProps & { icon: string; label: string }) {
  return (
    <Pressable
      {...props}
      style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}
    >
      <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
        <Text
          style={[
            styles.tabIcon,
            { color: isFocused ? palette.accentText : ON_DARK },
          ]}
        >
          {icon}
        </Text>
      </View>
      <Text
        style={[
          styles.tabLabel,
          { color: isFocused ? palette.accent : ON_DARK },
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
  tabIcon: { fontSize: 18, fontWeight: '700' },
  tabLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  pressed: { opacity: 0.6 },
});

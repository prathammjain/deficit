import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, View, StyleSheet, Text } from 'react-native';

import { palette, maxContentWidth, space, radius } from '@/constants/palette';

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
      style={({ pressed }) => [
        styles.tabButton,
        pressed && styles.pressed,
      ]}>
      <Text
        style={[
          styles.tabIcon,
          { color: isFocused ? palette.accent : palette.textFaint },
        ]}>
        {icon}
      </Text>
      <Text
        style={[
          styles.tabLabel,
          { color: isFocused ? palette.accent : palette.textFaint },
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function BottomTabList(props: TabListProps) {
  return (
    <View style={styles.tabListOuter}>
      <View {...props} style={styles.tabListInner}>
        {props.children}
      </View>
    </View>
  );
}

const TAB_BAR_HEIGHT = 56;

const styles = StyleSheet.create({
  tabListOuter: {
    backgroundColor: palette.bg,
    borderTopWidth: 1,
    borderTopColor: palette.hairline,
    paddingBottom: 0,
    /* env(safe-area-inset-bottom) handled by SafeAreaView in each Screen */
  },
  tabListInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: maxContentWidth,
    width: '100%',
    alignSelf: 'center',
    height: TAB_BAR_HEIGHT,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.sm,
    gap: 2,
  },
  tabIcon: {
    fontSize: 20,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  pressed: {
    opacity: 0.7,
  },
});


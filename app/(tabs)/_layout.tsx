// Bottom navigation: Home, Transactions, Reports, Settings. Square, flat, lucide icons.
import React from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { BarChart3, Home, ReceiptText, Settings } from 'lucide-react-native';
import { colors, spacing } from '../../utils/theme';

function TabIcon({ Icon, focused }: { Icon: React.ComponentType<any>; focused: boolean }) {
  // Subtle active-indicator transition on tab change.
  const style = useAnimatedStyle(() => ({ opacity: withTiming(focused ? 1 : 0, { duration: 200 }) }));
  return (
    <View style={{ alignItems: 'center', width: 56 }}>
      <Animated.View style={[styles.indicator, style]} />
      <Icon size={21} color={focused ? colors.accent : colors.textMuted} strokeWidth={focused ? 2.2 : 1.8} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.accent,
      tabBarInactiveTintColor: colors.textMuted,
      tabBarStyle: styles.tabBar,
      tabBarLabelStyle: styles.label,
      sceneStyle: { backgroundColor: colors.background },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ focused }) => <TabIcon Icon={Home} focused={!!focused} /> }} />
      <Tabs.Screen name="transactions" options={{ title: 'History', tabBarIcon: ({ focused }) => <TabIcon Icon={ReceiptText} focused={!!focused} /> }} />
      <Tabs.Screen name="reports" options={{ title: 'Reports', tabBarIcon: ({ focused }) => <TabIcon Icon={BarChart3} focused={!!focused} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ focused }) => <TabIcon Icon={Settings} focused={!!focused} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
    borderRadius: 0, elevation: 0, height: 64 + spacing.xs,
  },
  label: { fontSize: 11, fontWeight: '600' },
  indicator: { width: 28, height: 3, backgroundColor: colors.accent, marginBottom: 4 },
});

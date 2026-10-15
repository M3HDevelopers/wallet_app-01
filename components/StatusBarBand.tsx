// Shared top band painted behind the Android status bar so the system icons
// (time, battery) stay visible: light icons over a restrained forest-green
// band. Square, flat, no gradients — consistent with the design system.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, spacing, STATUS_BAND_LIGHT } from '../utils/theme';

interface Props {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function StatusBarBand({ title, subtitle, right }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.band, { height: Math.max(insets.top, 24) + (title ? 44 : 0) }]}>
      <View style={{ height: Math.max(insets.top, 24) }} />
      {title ? (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
          {right ?? null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  band: { backgroundColor: STATUS_BAND_LIGHT, paddingHorizontal: spacing.lg, justifyContent: 'flex-end' },
  row: { flexDirection: 'row', alignItems: 'center', paddingBottom: spacing.sm, gap: spacing.md },
  title: { ...font.section, color: colors.white },
  subtitle: { fontSize: 12, color: '#C9D8CE', marginTop: 1 },
});

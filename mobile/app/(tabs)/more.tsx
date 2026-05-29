import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

const MENU_ITEMS = [
  { label: 'Платежи', route: 'payments' },
  { label: 'Настройки', route: 'settings' },
  { label: 'Выход', route: 'logout' },
];

export default function MoreScreen() {
  return (
    <Screen>
      <Text style={styles.title}>Ещё</Text>

      <View style={styles.menu}>
        {MENU_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.route}
            style={styles.menuItem}
            activeOpacity={0.7}
          >
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.chevron}>{'>'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.version}>Sheber Mobile v1.0.0</Text>
        <Text style={styles.apiUrl}>
          API: {process.env.EXPO_PUBLIC_API_BASE_URL || 'localhost:8000'}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  menu: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuLabel: {
    fontSize: typography.sizes.base,
    color: colors.text,
  },
  chevron: {
    fontSize: typography.sizes.base,
    color: colors.textMuted,
  },
  footer: {
    marginTop: spacing['2xl'],
    alignItems: 'center',
  },
  version: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  apiUrl: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});

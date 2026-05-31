import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

const MENU_ITEMS: { label: string; route?: string; action?: 'logout' | 'placeholder' }[] = [
  { label: 'Платежи', route: 'payments' },
  { label: 'Настройки', route: 'settings' },
  { label: 'Выйти', action: 'logout' },
];

export default function MoreScreen() {
  const router = useRouter();

  const handlePress = (item: typeof MENU_ITEMS[0]) => {
    if (item.action === 'logout') {
      router.replace('/login');
      return;
    }
    if (item.route) {
      Alert.alert('В разработке', `Раздел «${item.label}» скоро будет доступен.`);
    }
  };

  return (
    <Screen>
      <Text style={styles.pageTitle}>Ещё</Text>

      <View style={styles.menu}>
        {MENU_ITEMS.map((item, index) => (
          <TouchableOpacity
            key={item.label}
            style={[
              styles.menuItem,
              index === MENU_ITEMS.length - 1 && styles.menuItemLast,
            ]}
            activeOpacity={0.7}
            onPress={() => handlePress(item)}
          >
            <Text style={[styles.menuLabel, item.action === 'logout' && styles.logoutLabel]}>
              {item.label}
            </Text>
            <Text style={styles.chevron}>{'→'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.apiBlock}>
        <Text style={styles.apiLabel}>API URL</Text>
        <Text style={styles.apiUrl}>
          {process.env.EXPO_PUBLIC_API_BASE_URL || 'localhost:8000'}
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.version}>Sheber Mobile v1.0.0</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  menu: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuLabel: {
    fontSize: typography.sizes.base,
    color: colors.text,
  },
  logoutLabel: {
    color: colors.danger.DEFAULT,
  },
  chevron: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  apiBlock: {
    marginTop: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  apiLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  apiUrl: {
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  footer: {
    marginTop: spacing['2xl'],
    alignItems: 'center',
  },
  version: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
});

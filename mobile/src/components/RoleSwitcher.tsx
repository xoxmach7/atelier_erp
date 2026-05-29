import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { radius } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { RoleKey } from '../types/work';

const ROLES: { key: RoleKey; label: string }[] = [
  { key: 'designer', label: 'Дизайнер' },
  { key: 'quotes', label: 'КП' },
  { key: 'warehouse', label: 'Склад' },
  { key: 'production', label: 'Пошив' },
  { key: 'installation', label: 'Установка' },
];

interface RoleSwitcherProps {
  activeRole: RoleKey;
  onRoleChange: (role: RoleKey) => void;
}

export function RoleSwitcher({ activeRole, onRoleChange }: RoleSwitcherProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {ROLES.map((role) => {
        const isActive = role.key === activeRole;
        return (
          <TouchableOpacity
            key={role.key}
            style={[styles.pill, isActive && styles.activePill]}
            onPress={() => onRoleChange(role.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.label, isActive && styles.activeLabel]}>
              {role.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    maxHeight: 48,
    marginBottom: spacing.base,
  },
  content: {
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
  },
  pill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.border,
  },
  activePill: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  activeLabel: {
    color: colors.white,
  },
});

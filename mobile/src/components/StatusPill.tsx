import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { radius } from '../theme/spacing';
import { typography } from '../theme/typography';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  new: { bg: colors.info.light, text: colors.info.dark },
  in_work: { bg: colors.info.light, text: colors.info.dark },
  in_production: { bg: colors.primary[100], text: colors.primary[700] },
  ready: { bg: colors.success.light, text: colors.success.dark },
  installation: { bg: colors.warning.light, text: colors.warning.dark },
  completed: { bg: colors.success.light, text: colors.success.dark },
  cancelled: { bg: colors.danger.light, text: colors.danger.dark },
  waiting_final_payment: { bg: colors.warning.light, text: colors.warning.dark },
  not_ready: { bg: colors.danger.light, text: colors.danger.dark },
  partially_ready: { bg: colors.warning.light, text: colors.warning.dark },
  ready_materials: { bg: colors.success.light, text: colors.success.dark },
  low: { bg: colors.success.light, text: colors.success.dark },
  medium: { bg: colors.warning.light, text: colors.warning.dark },
  high: { bg: colors.warning.light, text: colors.warning.dark },
  urgent: { bg: colors.danger.light, text: colors.danger.dark },
};

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  owner: { bg: '#EDE9FE', text: '#5B21B6' },
  designer: { bg: '#FCE7F3', text: '#9D174D' },
  quotes: { bg: '#FEF3C7', text: '#92400E' },
  warehouse: { bg: '#D1FAE5', text: '#065F46' },
  production: { bg: '#DBEAFE', text: '#1E40AF' },
  installation: { bg: '#CFFAFE', text: '#0E7490' },
  finance: { bg: '#E0E7FF', text: '#3730A3' },
};

interface StatusPillProps {
  status: string;
  variant?: 'status' | 'role' | 'priority';
}

export function StatusPill({ status, variant = 'status' }: StatusPillProps) {
  const palette =
    variant === 'role'
      ? ROLE_COLORS[status] || { bg: colors.neutral[200], text: colors.neutral[700] }
      : STATUS_COLORS[status] || { bg: colors.neutral[200], text: colors.neutral[700] };

  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }]}>
      <Text style={[styles.text, { color: palette.text }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    textTransform: 'capitalize',
  },
});

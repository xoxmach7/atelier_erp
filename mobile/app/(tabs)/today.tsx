import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { StatusPill } from '../../src/components/StatusPill';
import { EmptyState } from '../../src/components/EmptyState';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

const DASHBOARD_SECTIONS = [
  { label: 'Новые заказы', status: 'new', count: 0 },
  { label: 'Нужен замер', status: 'in_work', count: 0 },
  { label: 'Нужно КП', status: 'in_work', count: 0 },
  { label: 'Материалы не готовы', status: 'not_ready', count: 0 },
  { label: 'В пошиве', status: 'in_production', count: 0 },
  { label: 'Установка', status: 'installation', count: 0 },
  { label: 'Ждут оплату', status: 'waiting_final_payment', count: 0 },
];

export default function TodayScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.greeting}>Добрый день</Text>
        <Text style={styles.subtitle}>Сегодня</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>0</Text>
          <Text style={styles.statLabel}>В работе</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>0</Text>
          <Text style={styles.statLabel}>Срочно</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>0</Text>
          <Text style={styles.statLabel}>Завершить</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Требует внимания</Text>

      {DASHBOARD_SECTIONS.map((section) => (
        <View key={section.label} style={styles.row}>
          <Text style={styles.rowLabel}>{section.label}</Text>
          <View style={styles.rowRight}>
            <Text style={styles.rowCount}>{section.count}</Text>
            <StatusPill status={section.status} />
          </View>
        </View>
      ))}

      <EmptyState
        title="Нет срочных задач"
        subtitle="Все текущие задачи в норме"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
  },
  greeting: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.sizes.base,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.base,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.base,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.primary[500],
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.base,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    fontSize: typography.sizes.base,
    color: colors.text,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowCount: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textMuted,
  },
});

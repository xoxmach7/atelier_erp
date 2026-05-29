import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { StatusDot } from '../../src/components/StatusDot';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

type MetricKey = 'profit' | 'revenue' | 'expenses';

const METRICS: { key: MetricKey; label: string }[] = [
  { key: 'profit', label: 'Прибыль' },
  { key: 'revenue', label: 'Выручка' },
  { key: 'expenses', label: 'Расходы' },
];

const SUMMARY_ITEMS = [
  { label: 'Всего заказов', value: '0', dot: 'neutral' as const },
  { label: 'Выполнено', value: '0', dot: 'success' as const },
  { label: 'В работе', value: '0', dot: 'info' as const },
  { label: 'Требуют внимания', value: '0', dot: 'warning' as const },
  { label: 'Просрочено', value: '0', dot: 'danger' as const },
  { label: 'Ожидают оплаты', value: '0', dot: 'warning' as const },
  { label: 'Материалы на исходе', value: '0', dot: 'danger' as const },
  { label: 'Можно завершить', value: '0', dot: 'success' as const },
];

export default function TodayScreen() {
  const router = useRouter();
  const [activeMetric, setActiveMetric] = useState<MetricKey>('profit');

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.orgName}>Sheber Atelier</Text>
        <Text style={styles.period}>Май 2026</Text>
      </View>

      <View style={styles.toggles}>
        {METRICS.map((m) => (
          <TouchableOpacity
            key={m.key}
            style={[styles.toggle, activeMetric === m.key && styles.toggleActive]}
            onPress={() => setActiveMetric(m.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleLabel, activeMetric === m.key && styles.toggleLabelActive]}>
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>{METRICS.find(m => m.key === activeMetric)?.label}</Text>
        <Text style={styles.chartValue}>0 ₸</Text>
        <View style={styles.chartPlaceholder}>
          <View style={styles.barGroup}>
            <View style={[styles.bar, { height: 24 }]} />
            <View style={[styles.bar, { height: 40 }]} />
            <View style={[styles.bar, { height: 32 }]} />
            <View style={[styles.bar, { height: 48 }]} />
            <View style={[styles.bar, { height: 20 }]} />
            <View style={[styles.bar, { height: 36 }]} />
            <View style={[styles.bar, { height: 28 }]} />
          </View>
          <Text style={styles.chartHint}>Динамика по неделям (placeholder)</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Показатели</Text>

      {SUMMARY_ITEMS.map((item) => (
        <View key={item.label} style={styles.row}>
          <View style={styles.rowLeft}>
            <StatusDot variant={item.dot} />
            <Text style={styles.rowLabel}>{item.label}</Text>
          </View>
          <Text style={styles.rowValue}>{item.value}</Text>
        </View>
      ))}

      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => router.push('/(tabs)/orders')}
        activeOpacity={0.7}
      >
        <Text style={styles.linkButtonText}>Все заказы →</Text>
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
  },
  orgName: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  period: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  toggles: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  toggle: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  toggleLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  toggleLabelActive: {
    color: colors.white,
    fontWeight: typography.weights.semibold,
  },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.base,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  chartValue: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.base,
  },
  chartPlaceholder: {
    alignItems: 'center',
  },
  barGroup: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    height: 56,
    marginBottom: spacing.xs,
  },
  bar: {
    width: 20,
    backgroundColor: colors.primary[200],
    borderRadius: radius.sm,
  },
  chartHint: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
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
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowLabel: {
    fontSize: typography.sizes.base,
    color: colors.text,
  },
  rowValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  linkButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  linkButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.primary[500],
  },
});

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { StatusDot } from '../../src/components/StatusDot';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

const KPI_ITEMS = [
  { label: 'Всего заказов', value: '0', color: colors.primary[500] },
  { label: 'В работе', value: '0', color: colors.primary[500] },
  { label: 'Ожидают оплаты', value: '0', color: colors.warning.DEFAULT },
  { label: 'Просрочено', value: '0', color: colors.danger.DEFAULT },
  { label: 'Материалы', value: '0', color: colors.danger.DEFAULT },
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

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.orgName}>Sheber Atelier</Text>
        <Text style={styles.period}>Май 2026</Text>
      </View>

      <View style={styles.kpiGrid}>
        {KPI_ITEMS.map((item) => (
          <View key={item.label} style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: item.color }]}>{item.value}</Text>
            <Text style={styles.kpiLabel}>{item.label}</Text>
          </View>
        ))}
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
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.base,
    marginBottom: spacing.lg,
  },
  kpiCard: {
    width: '47%',
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.base,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  kpiValue: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    marginBottom: spacing.xs,
  },
  kpiLabel: {
    fontSize: typography.sizes.sm,
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

import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { SegmentControl } from '../../src/components/SegmentControl';
import { SimpleBarChart } from '../../src/components/SimpleBarChart';
import { SummaryRow } from '../../src/components/SummaryRow';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

const SEGMENTS = ['Прибыль', 'Выручка', 'Расходы'];

const CHART_DATA = [
  { label: 'Сен', value: 1.2 },
  { label: 'Окт', value: -0.3 },
  { label: 'Ноя', value: 5.0 },
  { label: 'Дек', value: 9.5 },
  { label: 'Янв', value: 8.8 },
  { label: 'Фев', value: 6.5 },
];

const SUMMARY_DATA = [
  { label: 'Все заказы (за период)', value: '843' },
  { label: 'В работе', value: '97' },
  { label: 'Ожидают оплаты', value: '10' },
  { label: 'Просрочено', value: '1', warning: 'danger' as const },
  { label: 'Материалы на исходе', value: '8', warning: 'warning' as const },
];

export default function TodayScreen() {
  const [activeSegment, setActiveSegment] = useState(1);
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.orgName}>Sheber Atelier</Text>
        <View style={styles.underline} />
        <View style={styles.periodRow}>
          <Text style={styles.period}>01.09.2025 - н.в.</Text>
          <Text style={styles.periodAction}>Выбрать период</Text>
        </View>
      </View>

      <SegmentControl
        segments={SEGMENTS}
        activeIndex={activeSegment}
        onSelect={setActiveSegment}
      />

      <SimpleBarChart data={CHART_DATA} />

      <View style={styles.summaryList}>
        {SUMMARY_DATA.map((item) => (
          <SummaryRow key={item.label} {...item} />
        ))}
      </View>

      <View style={styles.bottomAction}>
        <PrimaryButton
          title="Выйти из профиля"
          onPress={() => router.replace('/login')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
  },
  orgName: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.text,
    letterSpacing: -0.5,
  },
  underline: {
    height: 1,
    backgroundColor: colors.text,
    marginTop: 4,
    opacity: 0.15,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  period: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    fontWeight: typography.weights.medium,
  },
  periodAction: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  summaryList: {
    marginTop: spacing.lg,
  },
  bottomAction: {
    marginTop: spacing.lg,
    marginBottom: spacing['2xl'],
  },
});

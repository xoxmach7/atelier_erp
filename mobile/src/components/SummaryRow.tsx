import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { radius } from '../theme/spacing';
import { typography } from '../theme/typography';

interface SummaryRowProps {
  label: string;
  value: string;
  warning?: 'danger' | 'warning';
}

export function SummaryRow({ label, value, warning }: SummaryRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={styles.label}>{label}</Text>
        {warning === 'danger' && <Text style={styles.warningDanger}>▲</Text>}
        {warning === 'warning' && <Text style={styles.warningWarning}>▲</Text>}
      </View>
      <View style={styles.right}>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    marginBottom: spacing.xs,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    fontSize: typography.sizes.base,
    color: colors.text,
  },
  warningDanger: {
    fontSize: typography.sizes.sm,
    color: colors.danger.DEFAULT,
  },
  warningWarning: {
    fontSize: typography.sizes.sm,
    color: colors.warning.DEFAULT,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  value: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.primary[500],
  },
  chevron: {
    fontSize: typography.sizes.base,
    color: colors.textMuted,
  },
});

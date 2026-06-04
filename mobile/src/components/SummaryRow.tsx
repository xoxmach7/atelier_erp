import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

interface SummaryRowProps {
  label: string;
  value: string;
  warning?: 'danger' | 'warning';
}

export function SummaryRow({ label, value, warning }: SummaryRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.right}>
        <Text style={styles.value}>{value}</Text>
        {warning === 'danger' && (
          <Text style={styles.warnDanger}>⚠</Text>
        )}
        {warning === 'warning' && (
          <Text style={styles.warnWarning}>⚠</Text>
        )}
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
    backgroundColor: '#f4f4f4',
    borderRadius: 16,
    height: 53,
    paddingHorizontal: 18,
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: 16,
    fontWeight: '400',
    color: '#0f172a',
    flex: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  value: {
    fontSize: 24,
    fontWeight: '500',
    color: '#60cced',
    lineHeight: 28,
  },
  warnDanger: {
    fontSize: 14,
    color: '#ef4444',
  },
  warnWarning: {
    fontSize: 14,
    color: '#eab308',
  },
  chevron: {
    fontSize: 18,
    color: '#64748b',
    lineHeight: 20,
  },
});

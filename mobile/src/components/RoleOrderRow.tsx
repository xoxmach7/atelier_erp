import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusDot } from './StatusDot';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { radius } from '../theme/spacing';
import { typography } from '../theme/typography';

interface RoleOrderRowProps {
  orderNumber: string;
  client: string;
  date?: string;
  subtitle?: string;
  statusColor?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  onPress?: () => void;
}

export function RoleOrderRow({
  orderNumber,
  client,
  date,
  subtitle,
  statusColor = 'neutral',
  onPress,
}: RoleOrderRowProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.left}>
        <Text style={styles.orderNumber}>{orderNumber}</Text>
        <Text style={styles.client}>{client}</Text>
        {date && <Text style={styles.meta}>{date}</Text>}
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      <StatusDot variant={statusColor} size={10} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.base,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
  },
  left: {
    flex: 1,
  },
  orderNumber: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  client: {
    fontSize: typography.sizes.base,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  meta: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});

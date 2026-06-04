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
  statusColor?: 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral';
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
        <View style={styles.topLine}>
          <Text style={styles.orderNumber}>{orderNumber}</Text>
          {date && <Text style={styles.date}>{date}</Text>}
        </View>
        <Text style={styles.client}>{client}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      <View style={styles.status}>
        <StatusDot variant={statusColor} size={10} />
      </View>
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
    padding: spacing.md,
    marginBottom: spacing.base,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  left: {
    flex: 1,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  orderNumber: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  date: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  client: {
    fontSize: typography.sizes.base,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  status: {
    marginLeft: spacing.base,
    alignSelf: 'flex-start',
    paddingTop: spacing.xs,
  },
});

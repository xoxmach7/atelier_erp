import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { radius } from '../theme/spacing';
import { typography } from '../theme/typography';

interface OrderListRowProps {
  title: string;
  date?: string;
  designer?: string;
  statusColor?: string;
  onPress?: () => void;
}

export function OrderListRow({
  title,
  date,
  designer,
  statusColor,
  onPress,
}: OrderListRowProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.left}>
        <Text style={styles.titleText}>{title}</Text>
        {date ? <Text style={styles.dateText}>{date}</Text> : null}
        {designer ? <Text style={styles.designerText}>{designer}</Text> : null}
      </View>
      <View style={styles.dotWrap}>
        <View
          style={[
            styles.dot,
            { backgroundColor: statusColor ?? colors.neutral[400] },
          ]}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    marginBottom: spacing.xs,
    minHeight: 88,
  },
  left: {
    flex: 1,
  },
  titleText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  dateText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  designerText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  dotWrap: {
    marginLeft: spacing.base,
    justifyContent: 'center',
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
});

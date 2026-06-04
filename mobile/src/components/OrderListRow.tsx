import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

interface OrderListRowProps {
  title: string;
  date?: string;
  subtitle?: string;
  statusColor?: string;
  onPress?: () => void;
}

export function OrderListRow({ title, date, subtitle, statusColor, onPress }: OrderListRowProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.left}>
        <Text style={styles.titleText}>{title}</Text>
        {date ? <Text style={styles.metaText}>{date}</Text> : null}
        {subtitle ? <Text style={styles.metaText}>{subtitle}</Text> : null}
      </View>
      <View style={[styles.dot, { backgroundColor: statusColor ?? colors.neutral[300] }]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.base,
    paddingHorizontal: 29,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    minHeight: 88,
  },
  left: {
    flex: 1,
    paddingRight: spacing.xl,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.text,
    marginBottom: 2,
  },
  metaText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    flexShrink: 0,
  },
});

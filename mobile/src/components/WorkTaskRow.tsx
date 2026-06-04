import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { radius } from '../theme/spacing';
import { typography } from '../theme/typography';

export type TaskIconType = 'danger' | 'warning' | 'success' | 'primary' | 'neutral';

interface WorkTaskRowProps {
  title: string;
  date?: string;
  subtitle?: string;
  context?: string;
  icon?: TaskIconType;
  onPress?: () => void;
}

const ICON_TEXT: Record<TaskIconType, string> = {
  danger: '▲',
  warning: '▲',
  success: '✓',
  primary: '●',
  neutral: '●',
};

const ICON_COLOR: Record<TaskIconType, string> = {
  danger: colors.danger.DEFAULT,
  warning: colors.warning.DEFAULT,
  success: colors.success.DEFAULT,
  primary: colors.primary[500],
  neutral: colors.neutral[400],
};

export function WorkTaskRow({ title, date, subtitle, context, icon = 'neutral', onPress }: WorkTaskRowProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.left}>
        <Text style={styles.titleText}>{title}</Text>
        {date ? <Text style={styles.metaText}>{date}</Text> : null}
        {subtitle ? <Text style={styles.actionText}>{subtitle}</Text> : null}
        {context ? <Text style={styles.contextText}>{context}</Text> : null}
      </View>
      <View style={styles.iconWrap}>
        <Text style={[styles.iconText, { color: ICON_COLOR[icon] }]}>
          {ICON_TEXT[icon]}
        </Text>
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
    minHeight: 96,
  },
  left: {
    flex: 1,
  },
  titleText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: 2,
  },
  metaText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginBottom: 2,
  },
  actionText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text,
    marginBottom: 2,
  },
  contextText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  iconWrap: {
    marginLeft: spacing.base,
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 18,
    fontWeight: typography.weights.bold,
  },
});

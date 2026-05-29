import { View, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const DOT_COLORS: Record<string, string> = {
  success: colors.success.DEFAULT,
  warning: colors.warning.DEFAULT,
  danger: colors.danger.DEFAULT,
  info: colors.info.DEFAULT,
  neutral: colors.neutral[300],
};

interface StatusDotProps {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: number;
}

export function StatusDot({ variant = 'neutral', size = 8 }: StatusDotProps) {
  return (
    <View
      style={[
        styles.dot,
        { backgroundColor: DOT_COLORS[variant] || colors.neutral[300], width: size, height: size, borderRadius: size / 2 },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    flexShrink: 0,
  },
});

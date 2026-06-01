import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { radius } from '../theme/spacing';
import { typography } from '../theme/typography';

interface SegmentControlProps {
  segments: string[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

export function SegmentControl({ segments, activeIndex, onSelect }: SegmentControlProps) {
  return (
    <View style={styles.container}>
      {segments.map((segment, index) => {
        const isActive = index === activeIndex;
        return (
          <TouchableOpacity
            key={segment}
            style={[styles.pill, isActive && styles.activePill]}
            onPress={() => onSelect(index)}
            activeOpacity={0.8}
          >
            <Text style={[styles.label, isActive && styles.activeLabel]}>
              {segment}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  pill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
  },
  activePill: {
    backgroundColor: colors.primary[500],
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textMuted,
  },
  activeLabel: {
    color: colors.white,
    fontWeight: typography.weights.semibold,
  },
});

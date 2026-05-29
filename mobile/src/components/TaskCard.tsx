import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusPill } from './StatusPill';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { radius } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { WorkQueueItem } from '../types/work';

interface TaskCardProps {
  item: WorkQueueItem;
  onPress?: () => void;
}

export function TaskCard({ item, onPress }: TaskCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <Text style={styles.orderNumber}>{item.orderNumber}</Text>
        <StatusPill status={item.status} />
      </View>

      <Text style={styles.clientName}>{item.clientName}</Text>
      {item.clientPhone && (
        <Text style={styles.meta}>{item.clientPhone}</Text>
      )}
      {item.address && (
        <Text style={styles.meta}>{item.address}</Text>
      )}

      <View style={styles.footer}>
        {item.priority && (
          <StatusPill status={item.priority} variant="priority" />
        )}
        {item.dueDate && (
          <Text style={styles.dueDate}>{item.dueDate}</Text>
        )}
        {item.materialReadiness && (
          <StatusPill status={item.materialReadiness} />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.base,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  orderNumber: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  clientName: {
    fontSize: typography.sizes.base,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  meta: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  dueDate: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
});

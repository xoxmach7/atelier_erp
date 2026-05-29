import React, { useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { RoleSwitcher } from '../../src/components/RoleSwitcher';
import { TaskCard } from '../../src/components/TaskCard';
import { EmptyState } from '../../src/components/EmptyState';
import { useWorkQueue } from '../../src/hooks/useWorkQueues';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import type { RoleKey } from '../../src/types/work';

export default function WorkScreen() {
  const [activeRole, setActiveRole] = useState<RoleKey>('designer');
  const { data, count, loading, error } = useWorkQueue(activeRole);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Рабочие</Text>
        <Text style={styles.count}>{count} задач</Text>
      </View>

      <RoleSwitcher activeRole={activeRole} onRoleChange={setActiveRole} />

      {loading && (
        <ActivityIndicator size="large" color={colors.primary[500]} />
      )}

      {error && (
        <Text style={styles.error}>{error}</Text>
      )}

      {!loading && !error && data.length === 0 && (
        <EmptyState
          title="Нет задач"
          subtitle={`В очереди ${activeRole} пока нет задач`}
        />
      )}

      {!loading &&
        !error &&
        data.map((item) => (
          <TaskCard
            key={item.id}
            item={item}
            onPress={() => {
              // Navigate to order detail
            }}
          />
        ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  count: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  error: {
    color: colors.danger.DEFAULT,
    fontSize: typography.sizes.base,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});

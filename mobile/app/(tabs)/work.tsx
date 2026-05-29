import { useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { RoleSwitcher } from '../../src/components/RoleSwitcher';
import { RoleOrderRow } from '../../src/components/RoleOrderRow';
import { EmptyState } from '../../src/components/EmptyState';
import { useWorkQueue } from '../../src/hooks/useWorkQueues';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import type { RoleKey } from '../../src/types/work';

function getStatusColor(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  const s = status.toLowerCase();
  if (s.includes('completed') || s.includes('ready') || s.includes('done')) return 'success';
  if (s.includes('urgent') || s.includes('overdue') || s.includes('error') || s.includes('not_ready')) return 'danger';
  if (s.includes('warning') || s.includes('waiting') || s.includes('partial')) return 'warning';
  if (s.includes('in_work') || s.includes('in_production') || s.includes('new')) return 'info';
  return 'neutral';
}

function getNextStep(role: RoleKey, status: string): string {
  const map: Record<string, string> = {
    designer: 'Замер / КП',
    quotes: 'Согласование КП',
    warehouse: 'Сбор материалов',
    production: 'Пошив',
    installation: 'Установка',
  };
  return map[role] || 'В работе';
}

export default function WorkScreen() {
  const router = useRouter();
  const [activeRole, setActiveRole] = useState<RoleKey>('designer');
  const { data, count, loading, error } = useWorkQueue(activeRole);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>
          {activeRole === 'designer' && 'Дизайнер'}
          {activeRole === 'quotes' && 'КП'}
          {activeRole === 'warehouse' && 'Склад'}
          {activeRole === 'production' && 'Пошив'}
          {activeRole === 'installation' && 'Установка'}
        </Text>
        <Text style={styles.count}>{count} заказов</Text>
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
          title="Нет заказов"
          subtitle={`В очереди пока нет задач`}
        />
      )}

      {!loading &&
        !error &&
        data.map((item) => (
          <RoleOrderRow
            key={item.id}
            orderNumber={item.orderNumber}
            client={item.clientName}
            date={item.dueDate}
            subtitle={getNextStep(activeRole, item.status)}
            statusColor={getStatusColor(item.status)}
            onPress={() => router.push(`/orders/${item.orderId}`)}
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

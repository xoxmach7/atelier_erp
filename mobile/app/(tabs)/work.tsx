import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { WorkTaskRow, type TaskIconType } from '../../src/components/WorkTaskRow';
import { EmptyState } from '../../src/components/EmptyState';
import { useWorkQueue } from '../../src/hooks/useWorkQueues';
import { useAuthContext } from '../../src/context/AuthContext';
import type { RoleKey, WorkQueueItem } from '../../src/types/work';
import { colors } from '../../src/theme/colors';
import { spacing, radius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

function IconButton({ icon, onPress }: { icon: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.iconBtn} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.iconText}>{icon}</Text>
    </TouchableOpacity>
  );
}

function formatTaskTitle(orderNumber: string, clientName: string): string {
  const numMatch = orderNumber?.match(/\d+$/);
  const num = numMatch ? numMatch[0] : orderNumber ?? '—';
  const surname = clientName?.split(' ')[0] ?? '';
  return `№${num} [${surname}]`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  return `${day}.${month}.${year.slice(2)}`;
}

function getTaskIcon(item: WorkQueueItem, role: RoleKey): TaskIconType {
  if (item.priority === 'urgent') return 'danger';

  if (role === 'warehouse') {
    if (item.materialReadiness === 'not_ready') return 'danger';
    if (item.materialReadiness === 'partially_ready') return 'warning';
    if (item.materialReadiness === 'ready') return 'success';
    return 'neutral';
  }

  if (role === 'designer') {
    if (item.status === 'new') return 'primary';
    if (item.status === 'in_work') return 'warning';
    return 'neutral';
  }

  if (role === 'production') {
    if (item.status === 'in_production') return 'primary';
    return 'neutral';
  }

  if (role === 'installation') {
    if (item.status === 'ready') return 'warning';
    if (item.status === 'installation') return 'primary';
    return 'neutral';
  }

  return 'neutral';
}

function getTaskSubtitle(item: WorkQueueItem, _role: RoleKey): string {
  if (item.actions && item.actions.length > 0) {
    return item.actions[0];
  }
  return 'В работе';
}

export default function WorkScreen() {
  const router = useRouter();
  const { primaryRole } = useAuthContext();
  const { data, loading, error, isDemo, refetch } = useWorkQueue(primaryRole);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <Screen>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.leftAction}
          onPress={() => router.replace('/login')}
          activeOpacity={0.7}
        >
          <Text style={styles.leftActionText}>Выйти</Text>
        </TouchableOpacity>
        <Text style={styles.centerTitle}>Заказы</Text>
        <View style={styles.rightActions}>
          <IconButton icon="⌕" />
          <IconButton icon="≡" />
        </View>
      </View>

      {isDemo && (
        <View style={styles.demoBanner}>
          <Text style={styles.demoBannerText}>Демо-данные: backend требует авторизацию</Text>
        </View>
      )}

      {loading && !refreshing && (
        <ActivityIndicator size="large" color={colors.primary[500]} />
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && !error && data.length === 0 && (
        <EmptyState
          title="Нет заказов"
          subtitle="В очереди пока нет задач"
        />
      )}

      <ScrollView
        style={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {!loading &&
          !error &&
          data.map((item) => (
            <WorkTaskRow
              key={item.id}
              title={formatTaskTitle(item.orderNumber, item.clientName)}
              date={formatDate(item.dueDate)}
              subtitle={getTaskSubtitle(item, primaryRole)}
              context={item.context}
              icon={getTaskIcon(item, primaryRole)}
              onPress={() => router.push(`/orders/${item.orderId}`)}
            />
          ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  leftAction: {
    width: 60,
  },
  leftActionText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  centerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  rightActions: {
    width: 80,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    lineHeight: 18,
  },
  errorBox: {
    backgroundColor: colors.danger.light,
    borderRadius: radius.md,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.lg,
    marginVertical: spacing.lg,
    alignItems: 'center',
  },
  errorText: {
    color: colors.danger.DEFAULT,
    fontSize: typography.sizes.base,
    textAlign: 'center',
  },
  list: {
    paddingBottom: 40,
  },
  demoBanner: {
    backgroundColor: colors.neutral[100],
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    marginBottom: spacing.base,
  },
  demoBannerText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

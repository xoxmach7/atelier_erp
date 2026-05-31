import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { RoleSwitcher } from '../../src/components/RoleSwitcher';
import { RoleOrderRow } from '../../src/components/RoleOrderRow';
import { EmptyState } from '../../src/components/EmptyState';
import { useWorkQueue } from '../../src/hooks/useWorkQueues';
import { colors } from '../../src/theme/colors';
import { spacing, radius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import type { RoleKey } from '../../src/types/work';

function getStatusColor(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  const s = status.toLowerCase();
  if (s.includes('completed') || s.includes('ready') || s.includes('done')) return 'success';
  if (s.includes('urgent') || s.includes('overdue') || s.includes('error') || s.includes('not_ready')) return 'danger';
  if (s.includes('warning') || s.includes('waiting') || s.includes('partial')) return 'warning';
  if (s.includes('new')) return 'neutral';
  if (s.includes('in_work') || s.includes('in_production')) return 'info';
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

function getRoleTitle(role: RoleKey): string {
  const map: Record<string, string> = {
    designer: 'Дизайнер',
    quotes: 'КП',
    warehouse: 'Склад',
    production: 'Пошив',
    installation: 'Установка',
  };
  return map[role] || 'Рабочие';
}

function IconButton({ icon, onPress }: { icon: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.iconBtn} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.iconText}>{icon}</Text>
    </TouchableOpacity>
  );
}

export default function WorkScreen() {
  const router = useRouter();
  const [activeRole, setActiveRole] = useState<RoleKey>('designer');
  const { data, count, loading, error, isDemo } = useWorkQueue(activeRole);

  return (
    <Screen>
      <View style={styles.topBar}>
        <View style={styles.topBarPlaceholder} />
        <Text style={styles.pageTitle}>{getRoleTitle(activeRole)}</Text>
        <View style={styles.actions}>
          <IconButton icon="⌕" />
          <IconButton icon="≡" />
        </View>
      </View>

      <RoleSwitcher activeRole={activeRole} onRoleChange={setActiveRole} />

      {isDemo && (
        <View style={styles.demoBanner}>
          <Text style={styles.demoBannerText}>Демо-данные: backend требует авторизацию</Text>
        </View>
      )}

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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  topBarPlaceholder: {
    width: 60,
  },
  pageTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: 'center',
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: 60,
    justifyContent: 'flex-end',
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
    fontSize: typography.sizes.base,
    color: colors.text,
  },
  error: {
    color: colors.danger.DEFAULT,
    fontSize: typography.sizes.base,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  demoBanner: {
    backgroundColor: colors.warning.light,
    borderRadius: radius.lg,
    padding: spacing.base,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.warning.DEFAULT,
  },
  demoBannerText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.warning.dark,
    textAlign: 'center',
  },
});

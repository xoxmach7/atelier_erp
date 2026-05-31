import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { RoleSwitcher } from '../../src/components/RoleSwitcher';
import { RoleOrderRow } from '../../src/components/RoleOrderRow';
import { EmptyState } from '../../src/components/EmptyState';
import { useWorkQueue } from '../../src/hooks/useWorkQueues';
import { getOrderIndicator } from '../../src/utils/orderLabels';
import { colors } from '../../src/theme/colors';
import { spacing, radius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import type { RoleKey } from '../../src/types/work';

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
        data.map((item) => {
          const indicator = getOrderIndicator(item.status, item.materialReadiness);
          return (
            <RoleOrderRow
              key={item.id}
              orderNumber={item.orderNumber}
              client={item.clientName}
              date={item.dueDate}
              subtitle={getNextStep(activeRole, item.status)}
              statusColor={indicator.variant}
              onPress={() => router.push(`/orders/${item.orderId}`)}
            />
          );
        })}
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
  pageTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  actions: {
    flexDirection: 'row',
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
  error: {
    color: colors.danger.DEFAULT,
    fontSize: typography.sizes.base,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  demoBanner: {
    backgroundColor: colors.warning.light,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    marginBottom: spacing.base,
  },
  demoBannerText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.warning.dark,
    textAlign: 'center',
  },
});

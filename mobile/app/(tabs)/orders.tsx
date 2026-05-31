import { useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { RoleOrderRow } from '../../src/components/RoleOrderRow';
import { EmptyState } from '../../src/components/EmptyState';
import { useOrders } from '../../src/hooks/useOrder';
import { getStatusLabel } from '../../src/utils/orderLabels';
import { colors } from '../../src/theme/colors';
import { spacing, radius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

function getStatusColor(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  const s = status.toLowerCase();
  if (s.includes('completed') || s.includes('done') || s.includes('ready')) return 'success';
  if (s.includes('urgent') || s.includes('overdue') || s.includes('cancelled')) return 'danger';
  if (s.includes('waiting') || s.includes('payment') || s.includes('partial')) return 'warning';
  if (s.includes('new')) return 'neutral';
  if (s.includes('in_work') || s.includes('production')) return 'info';
  return 'neutral';
}

function IconButton({ icon, onPress }: { icon: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.iconBtn} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.iconText}>{icon}</Text>
    </TouchableOpacity>
  );
}

export default function OrdersScreen() {
  const router = useRouter();
  const { data, loading, error, isDemo } = useOrders();

  return (
    <Screen>
      <View style={styles.topBar}>
        <View style={styles.topBarPlaceholder} />
        <Text style={styles.pageTitle}>Управление заказами</Text>
        <View style={styles.actions}>
          <IconButton icon="⌕" />
          <IconButton icon="≡" />
          <IconButton icon="+" />
        </View>
      </View>

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
          subtitle="Заказы пока не созданы"
        />
      )}

      {!loading &&
        !error &&
        data.map((order) => (
          <RoleOrderRow
            key={order.id}
            orderNumber={order.orderNumber}
            client={order.customerName}
            date={order.dueDate}
            subtitle={getStatusLabel(order.status)}
            statusColor={getStatusColor(order.status)}
            onPress={() => router.push(`/orders/${order.id}`)}
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
    width: 80,
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
    width: 80,
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

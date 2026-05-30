import { useRouter } from 'expo-router';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { RoleOrderRow } from '../../src/components/RoleOrderRow';
import { EmptyState } from '../../src/components/EmptyState';
import { useOrders } from '../../src/hooks/useOrder';
import { colors } from '../../src/theme/colors';
import { spacing, radius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

function getStatusColor(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  const s = status.toLowerCase();
  if (s.includes('completed') || s.includes('done') || s.includes('ready')) return 'success';
  if (s.includes('urgent') || s.includes('overdue') || s.includes('cancelled')) return 'danger';
  if (s.includes('waiting') || s.includes('payment') || s.includes('partial')) return 'warning';
  if (s.includes('new') || s.includes('in_work') || s.includes('production')) return 'info';
  return 'neutral';
}

export default function OrdersScreen() {
  const router = useRouter();
  const { data, loading, error, isDemo } = useOrders();

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Заказы</Text>
        <Text style={styles.count}>{data.length} всего</Text>
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
            subtitle={order.status}
            statusColor={getStatusColor(order.status)}
            onPress={() => router.push(`/orders/${order.id}`)}
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

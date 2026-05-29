import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { StatusPill } from '../../src/components/StatusPill';
import { EmptyState } from '../../src/components/EmptyState';
import { useOrders } from '../../src/hooks/useOrder';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function OrdersScreen() {
  const { data, loading, error } = useOrders();

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Заказы</Text>
        <Text style={styles.count}>{data.length} всего</Text>
      </View>

      {loading && (
        <Text style={styles.loading}>Загрузка...</Text>
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
          <TouchableOpacity
            key={order.id}
            style={styles.orderCard}
            activeOpacity={0.7}
          >
            <View style={styles.orderHeader}>
              <Text style={styles.orderNumber}>{order.orderNumber}</Text>
              <StatusPill status={order.status} />
            </View>
            <Text style={styles.customer}>{order.customerName}</Text>
            <Text style={styles.amount}>
              {order.paidAmount} / {order.totalAmount}
            </Text>
          </TouchableOpacity>
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
  loading: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
  error: {
    color: colors.danger.DEFAULT,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  orderCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.base,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orderHeader: {
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
  customer: {
    fontSize: typography.sizes.base,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  amount: {
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
});

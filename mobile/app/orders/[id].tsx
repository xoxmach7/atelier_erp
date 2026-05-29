import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { StatusPill } from '../../src/components/StatusPill';
import { EmptyState } from '../../src/components/EmptyState';
import { useOrderDetail } from '../../src/hooks/useOrder';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function OrderDetailScreen({ route }: any) {
  const orderId = route?.params?.id;
  const { data, loading, error } = useOrderDetail(orderId);

  if (loading) {
    return (
      <Screen>
        <Text style={styles.loading}>Загрузка...</Text>
      </Screen>
    );
  }

  if (error || !data) {
    return (
      <Screen>
        <EmptyState
          title="Заказ не найден"
          subtitle={error || 'Проверьте ID заказа'}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.orderNumber}>{data.orderNumber}</Text>
        <StatusPill status={data.status} />
      </View>

      <Text style={styles.customer}>{data.customerName}</Text>
      <Text style={styles.phone}>{data.customerPhone}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Сумма</Text>
        <Text style={styles.amount}>
          Оплачено: {data.paidAmount} / {data.totalAmount}
        </Text>
      </View>

      {data.photoReportStatus && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Фотоотчёт</Text>
          <StatusPill status={data.photoReportStatus} />
        </View>
      )}

      {data.avrStatus && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>АВР</Text>
          <StatusPill status={data.avrStatus} />
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
          <Text style={styles.actionText}>Добавить платёж</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  orderNumber: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  customer: {
    fontSize: typography.sizes.lg,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  phone: {
    fontSize: typography.sizes.base,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  section: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.base,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  amount: {
    fontSize: typography.sizes.base,
    color: colors.text,
  },
  actions: {
    marginTop: spacing.lg,
  },
  actionButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  actionText: {
    color: colors.white,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
});

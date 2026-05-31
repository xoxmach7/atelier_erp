import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { StatusDot } from '../../src/components/StatusDot';
import { EmptyState } from '../../src/components/EmptyState';
import { useOrderDetail } from '../../src/hooks/useOrder';
import { getStatusLabel, getNextStepLabel } from '../../src/utils/orderLabels';
import { formatCurrency } from '../../src/utils/formatters';
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

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, isDemo } = useOrderDetail(id);

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
      {isDemo && (
        <View style={styles.demoBanner}>
          <Text style={styles.demoBannerText}>Демо-данные: backend требует авторизацию</Text>
        </View>
      )}

      <View style={styles.header}>
        <View>
          <Text style={styles.orderNumber}>{data.orderNumber}</Text>
          <Text style={styles.customer}>{data.customerName}</Text>
          {data.customerPhone && <Text style={styles.meta}>{data.customerPhone}</Text>}
        </View>
        <StatusDot variant={getStatusColor(data.status)} size={12} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Статус</Text>
        <Text style={styles.cardValue}>{getStatusLabel(data.status)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Следующий шаг</Text>
        <Text style={styles.cardValue}>{getNextStepLabel(data.status)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Оплата</Text>
        <Text style={styles.cardValue}>
          {formatCurrency(data.paidAmount)} / {formatCurrency(data.totalAmount)}
        </Text>
      </View>

      {data.photoReportStatus && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Фотоотчёт</Text>
          <Text style={styles.cardValue}>{data.photoReportStatus}</Text>
        </View>
      )}

      {data.avrStatus && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>АВР</Text>
          <Text style={styles.cardValue}>{data.avrStatus}</Text>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
          <Text style={styles.actionText}>Выполнить действие</Text>
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
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  orderNumber: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  customer: {
    fontSize: typography.sizes.base,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  meta: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.base,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  cardValue: {
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

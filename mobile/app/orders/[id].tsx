import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { StatusDot } from '../../src/components/StatusDot';
import { EmptyState } from '../../src/components/EmptyState';
import { useOrderDetail } from '../../src/hooks/useOrder';
import { getOrderIndicator, getNextStepLabel } from '../../src/utils/orderLabels';
import { formatCurrency } from '../../src/utils/formatters';
import { colors } from '../../src/theme/colors';
import { spacing, radius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

const DOC_STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает',
  uploaded: 'Загружен',
  signed: 'Подписан',
  done: 'Выполнен',
  draft: 'Черновик',
  not_required: 'Не требуется',
};

function translateDocStatus(status: string | null | undefined): string {
  if (!status) return 'Не готово';
  return DOC_STATUS_LABELS[status.toLowerCase()] ?? status;
}

function StatusRow({ label, value, dot }: { label: string; value: string; dot?: 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral' }) {
  return (
    <View style={styles.cardRow}>
      <Text style={styles.cardLabel}>{label}</Text>
      <View style={styles.cardRowRight}>
        <Text style={styles.cardValue}>{value}</Text>
        {dot && <StatusDot variant={dot} size={8} />}
      </View>
    </View>
  );
}

export default function OrderDetailScreen() {
  const router = useRouter();
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

  const paymentText = `${formatCurrency(data.paidAmount)} из ${formatCurrency(data.totalAmount)}`;

  return (
    <Screen>
      {isDemo && (
        <View style={styles.demoBanner}>
          <Text style={styles.demoBannerText}>Демо-данные: backend требует авторизацию</Text>
        </View>
      )}

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.back}>← Назад</Text>
        </TouchableOpacity>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.orderNumber}>{data.orderNumber}</Text>
            <Text style={styles.customer}>{data.customerName}</Text>
            {data.customerPhone && <Text style={styles.meta}>{data.customerPhone}</Text>}
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <StatusRow
          label="СТАТУС"
          value={getOrderIndicator(data.status).label}
          dot={getOrderIndicator(data.status).variant}
        />
        <View style={styles.divider} />
        <StatusRow label="СЛЕДУЮЩИЙ ШАГ" value={getNextStepLabel(data.status)} />
      </View>

      <View style={styles.card}>
        <StatusRow label="ОПЛАТА" value={paymentText} />
        {data.dueDate && (
          <>
            <View style={styles.divider} />
            <StatusRow label="СРОК" value={data.dueDate} />
          </>
        )}
      </View>

      {data.photoReportStatus && (
        <View style={styles.card}>
          <StatusRow label="ФОТООТЧЁТ" value={translateDocStatus(data.photoReportStatus)} />
        </View>
      )}

      {data.avrStatus && (
        <View style={styles.card}>
          <StatusRow label="АВР" value={translateDocStatus(data.avrStatus)} />
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
  headerLeft: {
    flex: 1,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: spacing.sm,
  },
  back: {
    fontSize: typography.sizes.sm,
    color: colors.primary[500],
    marginBottom: spacing.sm,
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
    borderRadius: radius.xl,
    padding: spacing.base,
    marginBottom: spacing.base,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  cardValue: {
    fontSize: typography.sizes.base,
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
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

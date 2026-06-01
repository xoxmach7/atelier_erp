import { useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { OrderListRow } from '../../src/components/OrderListRow';
import { EmptyState } from '../../src/components/EmptyState';
import { useOrders } from '../../src/hooks/useOrder';
import { getOrderIndicator } from '../../src/utils/orderLabels';
import type { Order } from '../../src/types/order';
import { colors } from '../../src/theme/colors';
import { spacing, radius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

const STATUS_COLOR: Record<string, string> = {
  neutral: colors.neutral[400],
  primary: colors.primary[500],
  warning: colors.warning.DEFAULT,
  success: colors.success.DEFAULT,
  danger: colors.danger.DEFAULT,
};

const DEMO_DESIGNERS: Record<string, string> = {
  'demo-1': 'Ибраева',
  'demo-2': 'Кенесова',
  'demo-3': 'Алиева',
  'demo-4': 'Смагулова',
  'demo-5': 'Тулегенова',
};

function IconButton({ icon, onPress }: { icon: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.iconBtn} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.iconText}>{icon}</Text>
    </TouchableOpacity>
  );
}

function formatOrderTitle(order: Order): string {
  const numMatch = order.orderNumber?.match(/\d+$/);
  const num = numMatch ? numMatch[0] : order.orderNumber ?? '—';
  const surname = order.customerName?.split(' ')[0] ?? '';
  return `№${num} [${surname}]`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  return `${day}.${month}.${year.slice(2)}`;
}

function formatDesigner(order: Order): string {
  const name = DEMO_DESIGNERS[order.id];
  return name ? `Дизайнер: ${name}` : 'Дизайнер: —';
}

export default function OrdersScreen() {
  const router = useRouter();
  const { data, loading, error, isDemo } = useOrders();

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text style={styles.pageTitle}>Управление заказами</Text>
        <View style={styles.actions}>
          <IconButton icon="+" />
          <IconButton icon="⌕" />
          <IconButton icon="≡" />
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

      <View style={styles.list}>
        {!loading &&
          !error &&
          data.map((order) => {
            const indicator = getOrderIndicator(order.status);
            return (
              <OrderListRow
                key={order.id}
                title={formatOrderTitle(order)}
                date={formatDate(order.dueDate)}
                designer={formatDesigner(order)}
                statusColor={STATUS_COLOR[indicator.variant]}
                onPress={() => router.push(`/orders/${order.id}`)}
              />
            );
          })}
      </View>
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
    fontSize: typography.sizes['2xl'],
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
  list: {
    paddingBottom: spacing['2xl'],
  },
});

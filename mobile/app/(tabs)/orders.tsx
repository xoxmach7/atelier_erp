import { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { OrderListRow } from '../../src/components/OrderListRow';
import { EmptyState } from '../../src/components/EmptyState';
import { useOrders } from '../../src/hooks/useOrder';
import { useAuthContext } from '../../src/context/AuthContext';
import { getStatusDotColor, getStatusLabel } from '../../src/utils/orderLabels';
import type { Order } from '../../src/types/order';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

const STATUS_FILTERS = [
  { key: undefined,              label: 'Все' },
  { key: 'new',                  label: 'Новые' },
  { key: 'in_work',              label: 'В работе' },
  { key: 'in_production',        label: 'Пошив' },
  { key: 'ready',                label: 'Готовы' },
  { key: 'on_installation',      label: 'Установка' },
  { key: 'waiting_final_payment',label: 'Оплата' },
] as const;

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  return `${day}.${month}.${year.slice(2)}`;
}

function orderTitle(order: Order): string {
  const numMatch = order.order_number?.match(/\d+$/);
  const num = numMatch ? numMatch[0] : order.order_number ?? '—';
  const surname = order.customer_name?.split(' ')[0] ?? '';
  return `№${num} [${surname}]`;
}

function orderSubtitle(order: Order): string {
  const date = formatDate(order.planned_completion ?? order.created_at);
  const status = getStatusLabel(order.status);
  return date ? `${date} · ${status}` : status;
}

export default function OrdersScreen() {
  const router = useRouter();
  const { primaryRole } = useAuthContext();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const { data, total, loading, error, refetch } = useOrders(statusFilter);

  const filtered = search.trim()
    ? data.filter(o =>
        o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        o.order_number?.toLowerCase().includes(search.toLowerCase())
      )
    : data;

  const canCreate = primaryRole === 'owner' || primaryRole === 'designer' || primaryRole === 'quotes';

  return (
    <Screen scrollable={false} withPadding={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Управление заказами</Text>
        <View style={styles.headerActions}>
          {canCreate && (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push('/orders/new')}
              activeOpacity={0.7}
            >
              <Text style={styles.iconText}>＋</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setShowSearch(v => !v)}
            activeOpacity={0.7}
          >
            <Text style={styles.iconText}>⌕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      {showSearch && (
        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput}
            placeholder="Поиск по клиенту или номеру"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
        </View>
      )}

      {/* Status filter pills */}
      <FlatList
        data={STATUS_FILTERS}
        keyExtractor={item => item.key ?? 'all'}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterList}
        contentContainerStyle={styles.filterContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.pill, statusFilter === item.key && styles.pillActive]}
            onPress={() => setStatusFilter(item.key as string | undefined)}
            activeOpacity={0.7}
          >
            <Text style={[styles.pillText, statusFilter === item.key && styles.pillTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Count */}
      {!loading && !error && (
        <Text style={styles.countText}>{total} заказов</Text>
      )}

      {/* List */}
      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary[500]} />
        </View>
      )}

      {Boolean(error) && !loading && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refetch}>
            <Text style={styles.retryText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <OrderListRow
              title={orderTitle(item)}
              date={formatDate(item.planned_completion ?? item.created_at)}
              subtitle={getStatusLabel(item.status)}
              statusColor={getStatusDotColor(item.status)}
              onPress={() => router.push(`/orders/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              title="Заказов нет"
              subtitle={search ? 'Ничего не найдено по запросу' : 'Заказы появятся здесь'}
            />
          }
          onRefresh={refetch}
          refreshing={loading}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.medium,
    color: colors.text,
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 18,
    color: colors.white,
    lineHeight: 22,
  },
  searchWrap: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
  searchInput: {
    backgroundColor: '#f4f4f4',
    borderRadius: 10,
    height: 40,
    paddingHorizontal: spacing.base,
    fontSize: typography.sizes.base,
    color: colors.text,
  },
  filterList: {
    flexGrow: 0,
  },
  filterContent: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  pill: {
    paddingHorizontal: spacing.base,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f4f4f4',
  },
  pillActive: {
    backgroundColor: colors.primary[500],
  },
  pillText: {
    fontSize: typography.sizes.base,
    color: colors.textMuted,
    fontWeight: typography.weights.medium,
  },
  pillTextActive: {
    color: colors.white,
  },
  countText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing['2xl'],
  },
  errorBox: {
    margin: spacing.base,
    padding: spacing.base,
    backgroundColor: '#fff3f3',
    borderRadius: 8,
    gap: spacing.sm,
  },
  errorText: {
    fontSize: typography.sizes.sm,
    color: '#e53935',
  },
  retryText: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    textDecorationLine: 'underline',
  },
});

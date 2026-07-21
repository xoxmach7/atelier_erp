import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, StyleSheet, Platform, StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '../../src/components/EmptyState';
import { IconButton } from '../../src/components/Icon';
import { useOrders } from '../../src/hooks/useOrder';
import { useAuthContext } from '../../src/context/AuthContext';
import {
  getStatusDotColor, getOrderIndicator, getWarehouseLabel, getWarehouseColor,
  EXECUTION_SUBSTATUS_LABEL, EXECUTION_SUBSTATUS_COLOR,
  INSTALLER_SUBSTATUS_LABEL, INSTALLER_SUBSTATUS_COLOR,
  type IndicatorVariant,
} from '../../src/utils/orderLabels';
import type { Order } from '../../src/types/order';

// Фильтруем по группам статусов, а не по восьми техническим статусам FSM:
// раскладка группа→статусы задана на бэке (api/v1/filters.py ORDER_STATUS_GROUPS)
// и уходит туда как ?status_group=.
const STATUS_FILTERS = [
  { key: undefined,   label: 'Все' },
  { key: 'in_work',   label: 'В работе' },
  { key: 'overdue',   label: 'Просрочен' },
  { key: 'completed', label: 'Завершён' },
  { key: 'waiting',   label: 'Ожидание' },
] as const;

// Склад фильтрует по обеспечению материалами (material_readiness),
// а не по стадии заказа.
const WAREHOUSE_FILTERS = [
  { key: undefined,          label: 'Все' },
  { key: 'not_ready',        label: 'Закуп' },
  { key: 'partially_ready',  label: 'Сборка' },
  { key: 'ready',            label: 'Готово' },
] as const;

// Цех и установщик работают только с активными заказами: завершённые и
// ожидающие им не нужны, поэтому пилюль всего две.
const EXECUTOR_FILTERS = [
  { key: undefined,   label: 'Все' },
  { key: 'in_work',   label: 'В работе' },
  { key: 'overdue',   label: 'Просрочен' },
] as const;

const BADGE_HEX: Record<string, string> = {
  red: '#EF4444', yellow: '#EAB308', green: '#22C55E', gray: '#CBD5E1',
};

function dotColor(order: Order): string {
  if (order.ui_badge?.color && BADGE_HEX[order.ui_badge.color]) return BADGE_HEX[order.ui_badge.color];
  return getStatusDotColor(order.status);
}

const INDICATOR_COLOR: Record<IndicatorVariant, string> = {
  danger: '#EF4444',
  warning: '#EAB308',
  success: '#22C55E',
  primary: '#22C55E',
  neutral: '#94A3B8',
};

function orderNum(order: Order): string {
  const m = order.order_number?.match(/\d+$/);
  return m ? m[0] : (order.order_number ?? '—');
}

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const p = dateStr.split('T')[0].split('-');
  if (p.length !== 3) return dateStr;
  const [y, m, d] = p;
  return `${d}.${m}.${y.slice(2)}`;
}

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({ order, warehouse, onPress }: {
  order: Order; warehouse: boolean; onPress: () => void;
}) {
  const designer = order.designer_name?.split(' ')[0] ?? '—';
  const indicator = getOrderIndicator(order.status, order.material_readiness, isOverdue(order));
  // Склад видит обеспечение материалами (Закуп/Сборка/Готово),
  // остальные роли — группу статуса заказа.
  //
  // Подпись берём с бэка (status_group_label / ui_badge.label), а не считаем
  // сами: локальный расчёт был третьей копией правил и расходился с карточкой
  // заказа — в списке «Просрочен», внутри «Новый».
  const indColor = warehouse
    ? getWarehouseColor(order.material_readiness)
    : (order.ui_badge?.color && BADGE_HEX[order.ui_badge.color]
        ? BADGE_HEX[order.ui_badge.color]
        : INDICATOR_COLOR[indicator.variant]);
  const label = warehouse
    ? getWarehouseLabel(order.material_readiness)
    : (order.status_group_label ?? order.ui_badge?.label ?? indicator.label);
  return (
    <TouchableOpacity style={card.wrap} onPress={onPress} activeOpacity={0.6}>
      <View style={card.content}>
        {/* Подстатус — приходит с бэка, не замена статусу справа, а пометка
            «заказ сейчас на мне». У цеха — бинарный «Исполнение»/ничего.
            У установщика — всегда одна из трёх стадий (2026-07-21). */}
        {order.execution_substatus === 'execution' && (
          <Text style={card.substatus}>{EXECUTION_SUBSTATUS_LABEL}</Text>
        )}
        {order.execution_substatus && order.execution_substatus in INSTALLER_SUBSTATUS_LABEL && (
          <Text style={[card.substatus, { color: INSTALLER_SUBSTATUS_COLOR[order.execution_substatus] }]}>
            {INSTALLER_SUBSTATUS_LABEL[order.execution_substatus]}
          </Text>
        )}
        <Text style={card.title}>№{orderNum(order)} | {order.customer_name}</Text>
        <Text style={card.line}><Text style={card.lineLabel}>Создан: </Text>{fmtDate(order.created_at)}</Text>
        <Text style={card.line}><Text style={card.lineLabel}>Дизайнер: </Text>{designer}</Text>
      </View>
      <View style={card.status}>
        <View style={[card.dot, { backgroundColor: indColor }]} />
        <Text style={[card.statusText, { color: indColor }]} numberOfLines={1}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

const card = StyleSheet.create({
  wrap: {
    backgroundColor: '#FAFBFC',
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F4',
    minHeight: 98,
  },
  content: { flex: 1 },
  substatus: {
    fontSize: 16,
    fontFamily: 'TTNormsPro-Bold',
    color: EXECUTION_SUBSTATUS_COLOR,
    marginBottom: 4,
  },
  title: { fontSize: 18, fontFamily: 'TTNormsPro-Regular', color: '#0F172A', marginBottom: 4 },
  line: { fontSize: 16, color: '#0F172A', fontFamily: 'TTNormsPro-Regular', marginTop: 2 },
  lineLabel: { fontFamily: 'TTNormsPro-Bold' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  dot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  statusText: { fontSize: 16, fontFamily: 'TTNormsPro-Bold' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

function isOverdue(o: Order): boolean {
  if (!o.planned_completion) return false;
  if (o.status === 'completed' || o.status === 'cancelled') return false;
  const today = new Date().toISOString().split('T')[0];
  return o.planned_completion.split('T')[0] < today;
}

export default function OrdersScreen() {
  const router = useRouter();
  const { primaryRole, logout } = useAuthContext();
  const params = useLocalSearchParams<{ status?: string }>();
  const insets = useSafeAreaInsets();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(params.status || undefined);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Экран живёт внутри таб-навигатора и не размонтируется между переходами —
  // без этого повторный router.push('/(tabs)/orders?status=...') с дашборда
  // не обновлял бы фильтр, т.к. useState читает params только при первом монтировании.
  useFocusEffect(
    useCallback(() => {
      setStatusFilter(params.status || undefined);
    }, [params.status])
  );

  const isWarehouse = primaryRole === 'warehouse';
  // 'production' — швейный цех (группа Seamstress, см. groupsToRole).
  const isSeamstress = primaryRole === 'production';
  const isInstaller = primaryRole === 'installation';
  const isExecutorRole = isWarehouse || isSeamstress || isInstaller;
  const filters = isWarehouse
    ? WAREHOUSE_FILTERS
    : (isSeamstress || isInstaller ? EXECUTOR_FILTERS : STATUS_FILTERS);

  // Склад фильтрует по material_readiness на клиенте (шкала не статусная),
  // остальные роли — по группе статусов на сервере (?status_group=).
  const { data, loading, error, refetch } = useOrders(
    undefined,
    isWarehouse ? undefined : statusFilter,
  );

  const filtered = search.trim()
    ? data.filter(o =>
        o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
        o.designer_name?.toLowerCase().includes(search.toLowerCase())
      )
    : data;

  const visible = isWarehouse && statusFilter
    ? filtered.filter(o => o.material_readiness === statusFilter)
    : filtered;

  const isOwner = primaryRole === 'owner';

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={[s.headerArea, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity onPress={() => (isOwner ? router.back() : logout())} activeOpacity={0.6}>
          <Text style={s.exit}>{isOwner ? 'Назад' : 'Выйти'}</Text>
        </TouchableOpacity>
        <Text style={s.title}>{isExecutorRole ? 'Заказы' : 'Управление заказами'}</Text>
        <View style={s.iconRow}>
          {/* Создание заказа и клиенты — только у ролей, которые их ведут.
              Исполнители работают по уже созданным заказам. */}
          {!isExecutorRole && (
            <>
              <IconButton name="plus" onPress={() => router.push('/orders/new')} />
              <IconButton name="user" onPress={() => router.push('/clients')} />
            </>
          )}
          <IconButton name="search" onPress={() => setShowSearch(v => !v)} />
          <IconButton name="filter" onPress={() => setShowFilters(v => !v)} />
        </View>
      </View>

      {/* Search */}
      {showSearch && (
        <View style={s.searchBar}>
          <TextInput
            style={s.searchInput}
            placeholder="Поиск по клиенту или номеру..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
        </View>
      )}

      {/* Filters */}
      {showFilters && (
        <View style={s.filtersList}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.filtersContent}
            keyboardShouldPersistTaps="handled"
          >
            {filters.map(item => {
              const active = statusFilter === item.key;
              return (
                <TouchableOpacity
                  key={item.label}
                  onPress={() => setStatusFilter(item.key)}
                  style={[s.chip, active && s.chipActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[s.chipText, active && s.chipTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* List */}
      {loading && (
        <View style={s.centered}><ActivityIndicator color="#60CCED" size="large" /></View>
      )}
      {Boolean(error) && !loading && (
        <View style={s.centered}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={refetch} style={s.retryBtn}><Text style={s.retryText}>Повторить</Text></TouchableOpacity>
        </View>
      )}
      {!loading && !error && (
        <FlatList
          data={visible}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={[s.listContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={loading}
          ListEmptyComponent={
            <EmptyState title="Нет заказов" subtitle={search ? 'Попробуйте другой запрос' : 'Заказы появятся здесь'} />
          }
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              warehouse={isWarehouse}
              onPress={() => router.push(`/orders/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  errorText: { color: '#EF4444', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#F4F4F4', borderRadius: 8 },
  retryText: { fontSize: 14, color: '#0F172A', fontFamily: 'TTNormsPro-Medium' },

  headerArea: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 16 : 20,
    paddingBottom: 14,
  },
  exit: { fontSize: 16, color: '#94A3B8', fontFamily: 'TTNormsPro-Regular', marginBottom: 8 },
  title: { fontSize: 30, fontFamily: 'TTNormsPro-Regular', color: '#0F172A', letterSpacing: -0.5 },
  iconRow: { flexDirection: 'row', gap: 16, marginTop: 14, justifyContent: 'flex-end' },

  searchBar: { paddingHorizontal: 20, paddingBottom: 10 },
  searchInput: {
    backgroundColor: '#F1F3F5', borderRadius: 10, height: 44,
    paddingHorizontal: 16, fontSize: 15, color: '#0F172A', fontFamily: 'TTNormsPro-Regular',
  },

  filtersList: { flexGrow: 0 },
  filtersContent: { paddingLeft: 20, paddingRight: 20, paddingBottom: 12, gap: 8, alignItems: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#EEF1F4' },
  chipActive: { backgroundColor: '#60CCED' },
  chipText: { fontSize: 14, color: '#475569', fontFamily: 'TTNormsPro-Medium' },
  chipTextActive: { color: '#FFFFFF' },

  listContent: { paddingBottom: 24 },
});

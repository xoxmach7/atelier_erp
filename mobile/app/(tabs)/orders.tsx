import { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, StyleSheet, Platform, StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '../../src/components/EmptyState';
import { IconButton, Icon } from '../../src/components/Icon';
import { useOrders } from '../../src/hooks/useOrder';
import { useAuthContext } from '../../src/context/AuthContext';
import { getStatusDotColor } from '../../src/utils/orderLabels';
import type { Order } from '../../src/types/order';

const STATUS_FILTERS = [
  { key: undefined,               label: 'Все' },
  { key: 'new',                   label: 'Новые' },
  { key: 'in_work',               label: 'В работе' },
  { key: 'in_production',         label: 'Пошив' },
  { key: 'ready',                 label: 'Готовы' },
  { key: 'on_installation',       label: 'Установка' },
  { key: 'waiting_final_payment', label: 'Оплата' },
] as const;

const BADGE_HEX: Record<string, string> = {
  red: '#EF4444', yellow: '#EAB308', green: '#22C55E', gray: '#CBD5E1',
};

function dotColor(order: Order): string {
  if (order.ui_badge?.color && BADGE_HEX[order.ui_badge.color]) return BADGE_HEX[order.ui_badge.color];
  return getStatusDotColor(order.status);
}

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

function OrderCard({ order, showMenu, onPress, onMenu }: {
  order: Order; showMenu: boolean; onPress: () => void; onMenu?: () => void;
}) {
  const designer = order.designer_name?.split(' ')[0] ?? '—';
  return (
    <TouchableOpacity style={card.wrap} onPress={onPress} activeOpacity={0.6}>
      <View style={card.content}>
        <Text style={card.title}>№{orderNum(order)} | {order.customer_name}</Text>
        <Text style={card.line}><Text style={card.lineLabel}>Создан: </Text>{fmtDate(order.created_at)}</Text>
        <Text style={card.line}><Text style={card.lineLabel}>Дизайнер: </Text>{designer}</Text>
      </View>
      <View style={[card.dot, { backgroundColor: dotColor(order) }]} />
      {showMenu && (
        <TouchableOpacity onPress={onMenu} style={card.menuBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="dots" size={20} color="#94A3B8" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const card = StyleSheet.create({
  wrap: {
    backgroundColor: '#FAFBFC',
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F4',
    minHeight: 98,
  },
  content: { flex: 1 },
  title: { fontSize: 18, fontFamily: 'TTNormsPro-Regular', color: '#0F172A', marginBottom: 4 },
  line: { fontSize: 16, color: '#0F172A', fontFamily: 'TTNormsPro-Regular', marginTop: 2 },
  lineLabel: { fontFamily: 'TTNormsPro-Bold' },
  dot: { width: 28, height: 28, borderRadius: 14, flexShrink: 0 },
  menuBtn: { width: 22, alignItems: 'center', justifyContent: 'center' },
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

  const { data, loading, error, refetch } = useOrders(statusFilter === 'overdue' ? undefined : statusFilter);

  const filtered = search.trim()
    ? data.filter(o =>
        o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
        o.designer_name?.toLowerCase().includes(search.toLowerCase())
      )
    : data;

  const visible = statusFilter === 'overdue' ? filtered.filter(isOverdue) : filtered;

  const isOwner = primaryRole === 'owner';

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={[s.headerArea, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity onPress={() => (isOwner ? router.back() : logout())} activeOpacity={0.6}>
          <Text style={s.exit}>{isOwner ? 'Назад' : 'Выйти'}</Text>
        </TouchableOpacity>
        <Text style={s.title}>Управление заказами</Text>
        <View style={s.iconRow}>
          <IconButton name="plus" onPress={() => router.push('/orders/new')} />
          <IconButton name="user" onPress={() => router.push('/clients')} />
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
        <FlatList
          horizontal
          data={STATUS_FILTERS}
          keyExtractor={item => item.label}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filtersContent}
          style={s.filtersList}
          renderItem={({ item }) => {
            const active = statusFilter === item.key;
            return (
              <TouchableOpacity onPress={() => setStatusFilter(item.key)} style={[s.chip, active && s.chipActive]} activeOpacity={0.7}>
                <Text style={[s.chipText, active && s.chipTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            );
          }}
        />
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
              showMenu={isOwner}
              onPress={() => router.push(`/orders/${item.id}`)}
              onMenu={() => router.push(`/orders/${item.id}`)}
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
  filtersContent: { paddingLeft: 20, paddingRight: 20, paddingBottom: 12, gap: 8, flexDirection: 'row' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#EEF1F4' },
  chipActive: { backgroundColor: '#60CCED' },
  chipText: { fontSize: 14, color: '#475569', fontFamily: 'TTNormsPro-Medium' },
  chipTextActive: { color: '#FFFFFF' },

  listContent: { paddingBottom: 24 },
});

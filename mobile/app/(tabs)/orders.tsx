import { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, StyleSheet, Platform, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { EmptyState } from '../../src/components/EmptyState';
import { useOrders } from '../../src/hooks/useOrder';
import { useAuthContext } from '../../src/context/AuthContext';
import { getStatusDotColor, getStatusLabel } from '../../src/utils/orderLabels';
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

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return dateStr;
  const [, month, day] = parts;
  return `${day}.${month}`;
}

function fmtMoney(v: string | number | null | undefined): string {
  if (!v) return '';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (!n || isNaN(n)) return '';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' млн';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + ' тыс';
  return String(n);
}

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({ order, onPress }: { order: Order; onPress: () => void }) {
  const dotColor = getStatusDotColor(order.status);
  const numMatch = order.order_number?.match(/\d+$/);
  const num = numMatch ? numMatch[0] : order.order_number ?? '—';
  const surname = order.customer_name?.split(' ')[0] ?? '';
  const date = formatDate(order.planned_completion ?? order.created_at);

  return (
    <TouchableOpacity style={card.wrap} onPress={onPress} activeOpacity={0.7}>
      <View style={card.content}>
        <Text style={card.title}>№{num} [{surname}]</Text>
        <Text style={card.sub}>{date}</Text>
        {Boolean(order.customer_name) && (
          <Text style={card.designer}>Дизайнер: {order.customer_name?.split(' ')[0] ?? '—'}</Text>
        )}
      </View>
      <View style={[card.dot, { backgroundColor: dotColor }]} />
    </TouchableOpacity>
  );
}

const card = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    marginBottom: 8,
  },
  dot: { width: 14, height: 14, borderRadius: 7, flexShrink: 0 },
  content: { flex: 1 },
  title: { fontSize: 14, fontFamily: 'TTNormsPro-Bold', color: '#0F172A' },
  sub: { fontSize: 12, color: '#64748B', marginTop: 2, fontFamily: 'TTNormsPro-Regular' },
  designer: { fontSize: 11, color: '#94A3B8', marginTop: 1, fontFamily: 'TTNormsPro-Regular' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function OrdersScreen() {
  const router = useRouter();
  const { primaryRole } = useAuthContext();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const { data, loading, error, refetch } = useOrders(statusFilter);

  const filtered = search.trim()
    ? data.filter(o =>
        o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        o.order_number?.toLowerCase().includes(search.toLowerCase())
      )
    : data;

  const canCreate = primaryRole === 'owner' || primaryRole === 'designer' || primaryRole === 'quotes';

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Заказы</Text>
        <View style={s.headerRight}>
          <TouchableOpacity
            style={s.iconBtn}
            onPress={() => setShowSearch(v => !v)}
            activeOpacity={0.7}
          >
            {/* Search icon — magnifier */}
            <View style={s.searchIcon}>
              <View style={s.searchCircle} />
              <View style={s.searchHandle} />
            </View>
          </TouchableOpacity>
          {canCreate && (
            <TouchableOpacity
              style={[s.iconBtn, s.iconBtnPrimary]}
              onPress={() => router.push('/orders/new')}
              activeOpacity={0.7}
            >
              <Text style={s.plusText}>+</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search bar */}
      {showSearch && (
        <View style={s.searchBar}>
          <TextInput
            style={s.searchInput}
            placeholder="Поиск по клиенту или номеру..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      )}

      {/* Status filters */}
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
            <TouchableOpacity
              onPress={() => setStatusFilter(item.key)}
              style={[s.chip, active && s.chipActive]}
              activeOpacity={0.7}
            >
              <Text style={[s.chipText, active && s.chipTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* List */}
      {loading && (
        <View style={s.centered}>
          <ActivityIndicator color="#60CCED" size="large" />
        </View>
      )}

      {Boolean(error) && !loading && (
        <View style={s.centered}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={refetch} style={s.retryBtn}>
            <Text style={s.retryText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={loading}
          ListEmptyComponent={
            <EmptyState
              title="Нет заказов"
              subtitle={search ? 'Попробуйте другой запрос' : 'Заказы появятся здесь'}
            />
          }
          renderItem={({ item }) => (
            <OrderCard
              order={item}
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
  screen: { flex: 1, backgroundColor: '#F2F4F7' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  errorText: { color: '#EF4444', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#F4F4F4', borderRadius: 8 },
  retryText: { fontSize: 14, color: '#0F172A', fontFamily: 'TTNormsPro-Medium' },

  // header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 16,
    paddingBottom: 12,
    backgroundColor: '#F2F4F7',
  },
  title: { fontSize: 22, fontFamily: 'TTNormsPro-Bold', color: '#0F172A', letterSpacing: -0.3 },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 2, elevation: 1,
  },
  iconBtnPrimary: { backgroundColor: '#60CCED' },
  plusText: { fontSize: 20, color: '#FFFFFF', lineHeight: 22, fontFamily: 'TTNormsPro-Regular' },

  // search icon (magnifier)
  searchIcon: { width: 18, height: 18, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  searchCircle: {
    width: 11, height: 11, borderRadius: 6,
    borderWidth: 1.8, borderColor: '#475569',
    position: 'absolute', top: 0, left: 0,
  },
  searchHandle: {
    width: 1.8, height: 6, backgroundColor: '#475569',
    borderRadius: 1, position: 'absolute', bottom: 0, right: 2,
    transform: [{ rotate: '45deg' }],
  },

  // search bar
  searchBar: { paddingHorizontal: 16, paddingBottom: 8 },
  searchInput: {
    backgroundColor: '#FFFFFF', borderRadius: 10, height: 40,
    paddingHorizontal: 14, fontSize: 14, color: '#0F172A',
    fontFamily: 'TTNormsPro-Regular',
  },

  // filters
  filtersList: { flexGrow: 0 },
  filtersContent: { paddingLeft: 16, paddingRight: 16, paddingBottom: 10, gap: 8, flexDirection: 'row' },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, backgroundColor: '#FFFFFF',
  },
  chipActive: { backgroundColor: '#60CCED' },
  chipText: { fontSize: 13, color: '#475569', fontFamily: 'TTNormsPro-Medium' },
  chipTextActive: { color: '#FFFFFF' },

  // list
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
});

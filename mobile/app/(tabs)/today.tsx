import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, ScrollView, RefreshControl, Platform, StatusBar,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthContext } from '../../src/context/AuthContext';
import { apiClient } from '../../src/api/client';
import { useWorkQueue } from '../../src/hooks/useWorkQueues';
import { WorkTaskRow, type TaskIconType } from '../../src/components/WorkTaskRow';
import type { WorkQueueItem } from '../../src/types/work';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardOrders {
  total: number; in_work: number; completed: number;
  cancelled: number; overdue: number; awaiting_payment: number;
}
interface DashboardFinance {
  total_revenue: number; total_paid: number; total_debt: number;
  this_month_revenue: number; this_month_paid: number;
}
interface ChartPoint { month: string; revenue: number; paid: number; }
interface DashboardResponse {
  orders: DashboardOrders; finance: DashboardFinance; chart: ChartPoint[];
}
interface InventoryItemLite { is_low_stock: boolean; }
interface InventoryListResponse { count: number; results: InventoryItemLite[]; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS_RU = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
function monthLabel(ym: string): string {
  const mm = parseInt(ym.slice(5, 7), 10);
  return MONTHS_RU[mm - 1] ?? ym.slice(5);
}
function fmtAxis(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'М';
  if (a >= 1_000) return (v / 1_000).toFixed(0) + 'к';
  return String(Math.round(v));
}

type ChartMode = 'profit' | 'revenue' | 'paid';
function valueFor(p: ChartPoint, mode: ChartMode): number {
  if (mode === 'paid') return p.paid;
  if (mode === 'profit') return p.revenue - p.paid;
  return p.revenue;
}

// ─── Bar Chart (ось Y + сетка + нулевая линия) ─────────────────────────────────

const PLOT_H = 200;
const GRID_LINES = 5;

function BarChart({ data, mode }: { data: ChartPoint[]; mode: ChartMode }) {
  const { top, bottom, ticks } = useMemo(() => {
    const vals = data.map((d) => valueFor(d, mode));
    const maxV = Math.max(...vals, 0);
    const minV = Math.min(...vals, 0);
    const t = maxV <= 0 ? 1 : maxV * 1.1;
    const b = minV >= 0 ? 0 : minV * 1.1;
    const arr: number[] = [];
    for (let i = 0; i < GRID_LINES; i++) arr.push(t - ((t - b) * i) / (GRID_LINES - 1));
    return { top: t, bottom: b, ticks: arr };
  }, [data, mode]);

  const range = top - bottom || 1;
  const yOf = (v: number) => ((top - v) / range) * PLOT_H;
  const zeroY = yOf(0);

  return (
    <View style={s.chartRow}>
      {/* Y axis labels */}
      <View style={s.yAxis}>
        {ticks.map((t, i) => (
          <Text key={i} style={s.yLabel}>{fmtAxis(t)}</Text>
        ))}
      </View>

      {/* Plot */}
      <View style={s.plot}>
        {/* horizontal dashed gridlines */}
        {ticks.map((_, i) => (
          <View key={`g${i}`} style={[s.gridLine, { top: (PLOT_H * i) / (GRID_LINES - 1) }]} />
        ))}
        {/* zero baseline */}
        <View style={[s.zeroLine, { top: zeroY }]} />

        {/* columns */}
        <View style={s.colsRow}>
          {data.map((p, i) => {
            const v = valueFor(p, mode);
            const yv = yOf(v);
            const barTop = Math.min(yv, zeroY);
            const barH = Math.max(Math.abs(yv - zeroY), 2);
            return (
              <View key={i} style={s.col}>
                <View style={s.colBg} />
                <View style={[s.bar, { top: barTop, height: barH }]} />
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({
  label, value, valueColor, onPress,
}: { label: string; value: number; valueColor: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={s.pill} activeOpacity={onPress ? 0.6 : 1} onPress={onPress}>
      <Text style={s.pillLabel}>{label}</Text>
      <View style={s.pillRight}>
        <Text style={[s.pillValue, { color: valueColor }]}>{value}</Text>
        <Text style={s.pillChevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Owner Dashboard ──────────────────────────────────────────────────────────

const CYAN = '#60CCED';
const RED = '#EF4444';
const ORANGE = '#F59E0B';

function OwnerDashboard() {
  const { logout } = useAuthContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [lowStock, setLowStock] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>('revenue');

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const [dash, inv] = await Promise.all([
        apiClient.get<DashboardResponse>('/api/v1/dashboard/'),
        apiClient.get<InventoryListResponse>('/api/v1/inventory-items/?page_size=200').catch(() => null),
      ]);
      setData(dash);
      if (inv?.results) setLowStock(inv.results.filter((it) => it.is_low_stock).length);
    } catch (err: any) {
      setError(err?.message ?? 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) {
    return <View style={s.centered}><ActivityIndicator color={CYAN} size="large" /></View>;
  }
  if (error) {
    return (
      <View style={s.centered}>
        <Text style={s.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => fetchAll()} style={s.retryBtn}>
          <Text style={s.retryText}>Повторить</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!data) return null;
  const { orders, chart } = data;

  const toggles: { key: ChartMode; label: string }[] = [
    { key: 'profit', label: 'Прибыль' },
    { key: 'revenue', label: 'Выручка' },
    { key: 'paid', label: 'Расходы' },
  ];

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={[s.scrollContent, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(true); }} tintColor={CYAN} />
      }
    >
      {/* Header */}
      <Text style={s.orgName}>Название организации</Text>
      <View style={s.periodRow}>
        <Text style={s.periodText}>01.09.2025 - н.в.</Text>
        <TouchableOpacity activeOpacity={0.6}>
          <Text style={s.periodLink}>Выбрать период</Text>
        </TouchableOpacity>
      </View>

      {/* Segmented toggle */}
      <View style={s.segRow}>
        {toggles.map(({ key, label }) => {
          const active = chartMode === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setChartMode(key)}
              style={[s.seg, active ? s.segActive : s.segInactive]}
              activeOpacity={0.7}
            >
              <Text style={[s.segText, active ? s.segTextActive : s.segTextInactive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Chart */}
      <BarChart data={chart} mode={chartMode} />
      <View style={s.xAxis}>
        <View style={s.xAxisSpacer} />
        <View style={s.xLabelsRow}>
          {chart.map((p, i) => (
            <Text key={i} style={s.xLabel}>{monthLabel(p.month)}</Text>
          ))}
        </View>
      </View>

      {/* Stat pills */}
      <View style={s.pills}>
        <StatPill label="Все заказы (за период)" value={orders.total} valueColor={CYAN} onPress={() => router.push('/(tabs)/orders')} />
        <StatPill label="В работе" value={orders.in_work} valueColor={CYAN} onPress={() => router.push('/(tabs)/orders?status=in_work')} />
        <StatPill label="Ожидают оплаты" value={orders.awaiting_payment} valueColor={CYAN} onPress={() => router.push('/(tabs)/orders?status=waiting')} />
        <StatPill label="Просрочено" value={orders.overdue} valueColor={RED} onPress={() => router.push('/(tabs)/orders?status=overdue')} />
        <StatPill label="Материалы на исходе" value={lowStock} valueColor={ORANGE} onPress={() => {}} />
      </View>

      {/* Logout */}
      <TouchableOpacity style={s.logoutBtn} onPress={() => logout()} activeOpacity={0.85}>
        <Text style={s.logoutText}>Выйти из профиля</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Non-owner view (work queue) ──────────────────────────────────────────────

function NonOwnerView() {
  const { primaryRole, user, logout } = useAuthContext();
  const insets = useSafeAreaInsets();
  const { data, loading, error, refetch } = useWorkQueue(primaryRole);
  const [refreshing, setRefreshing] = useState(false);

  const displayName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username
    : '';

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  function formatTitle(orderNumber: string, clientName: string): string {
    const numMatch = orderNumber?.match(/\d+$/);
    const num = numMatch ? numMatch[0] : orderNumber ?? '—';
    const surname = clientName?.split(' ')[0] ?? '';
    return `№${num} [${surname}]`;
  }

  function getIcon(item: WorkQueueItem): TaskIconType {
    if (item.priority === 'urgent') return 'danger';
    if (primaryRole === 'warehouse') {
      if (item.materialReadiness === 'not_ready') return 'danger';
      if (item.materialReadiness === 'partially_ready') return 'warning';
      if (item.materialReadiness === 'ready') return 'success';
    }
    return 'neutral';
  }

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={[s.scrollContent, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#60CCED" />
      }
    >
      <View style={s.header}>
        <Text style={s.headerTitle}>{displayName}</Text>
        <TouchableOpacity onPress={() => logout()} activeOpacity={0.7}>
          <Text style={s.logoutSmall}>Выйти</Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing && (
        <View style={s.centered}>
          <ActivityIndicator color="#60CCED" />
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

      {!loading && !error && data.map((item) => (
        <WorkTaskRow
          key={item.orderId}
          title={formatTitle(item.orderNumber, item.clientName)}
          date={item.dueDate}
          subtitle={item.context}
          icon={getIcon(item)}
        />
      ))}
    </ScrollView>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TodayScreen() {
  const { primaryRole } = useAuthContext();
  if (primaryRole === 'designer') return <Redirect href="/(tabs)/orders" />;
  return primaryRole === 'owner' ? <OwnerDashboard /> : <NonOwnerView />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 24 : 24,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, backgroundColor: '#FFFFFF' },
  errorText: { color: '#EF4444', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#F4F4F4', borderRadius: 8 },
  retryText: { fontSize: 14, color: '#0F172A', fontFamily: 'TTNormsPro-Medium' },

  // header
  orgName: { fontSize: 34, fontFamily: 'TTNormsPro-Regular', color: '#0F172A', letterSpacing: -0.5 },
  periodRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 20 },
  periodText: { fontSize: 18, color: '#0F172A', fontFamily: 'TTNormsPro-Regular' },
  periodLink: { fontSize: 18, color: '#94A3B8', fontFamily: 'TTNormsPro-Regular', marginLeft: 14 },

  // non-owner header
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, paddingTop: 8 },
  headerTitle: { fontSize: 20, fontFamily: 'TTNormsPro-Bold', color: '#0F172A', letterSpacing: -0.3 },
  logoutSmall: { fontSize: 12, color: '#94A3B8', fontFamily: 'TTNormsPro-Regular', paddingTop: 6 },

  // segmented toggle
  segRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  seg: { flex: 1, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  segActive: { backgroundColor: '#60CCED' },
  segInactive: { backgroundColor: '#EEF1F4' },
  segText: { fontSize: 16, fontFamily: 'TTNormsPro-Regular' },
  segTextActive: { color: '#FFFFFF' },
  segTextInactive: { color: '#9AA5B1' },

  // chart
  chartRow: { flexDirection: 'row', height: PLOT_H },
  yAxis: { width: 42, height: PLOT_H, justifyContent: 'space-between', paddingRight: 6 },
  yLabel: { fontSize: 11, color: '#94A3B8', textAlign: 'right', fontFamily: 'TTNormsPro-Regular' },
  plot: { flex: 1, height: PLOT_H, position: 'relative' },
  gridLine: {
    position: 'absolute', left: 0, right: 0, height: 0,
    borderTopWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed',
  },
  zeroLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#CBD5E1' },
  colsRow: { flexDirection: 'row', height: PLOT_H, alignItems: 'stretch' },
  col: { flex: 1, height: PLOT_H, position: 'relative', alignItems: 'center', marginHorizontal: 3 },
  colBg: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#F1F5F9', borderRadius: 2 },
  bar: { position: 'absolute', left: '18%', right: '18%', backgroundColor: '#60CCED', borderRadius: 2 },

  // x axis
  xAxis: { flexDirection: 'row', marginTop: 6 },
  xAxisSpacer: { width: 42 },
  xLabelsRow: { flex: 1, flexDirection: 'row' },
  xLabel: { flex: 1, textAlign: 'center', fontSize: 12, color: '#475569', fontFamily: 'TTNormsPro-Regular' },

  // stat pills
  pills: { marginTop: 24, gap: 14 },
  pill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F1F3F5', borderRadius: 16, paddingHorizontal: 22, height: 64,
  },
  pillLabel: { fontSize: 17, color: '#0F172A', fontFamily: 'TTNormsPro-Regular', flex: 1 },
  pillRight: { flexDirection: 'row', alignItems: 'center' },
  pillValue: { fontSize: 24, fontFamily: 'TTNormsPro-Bold' },
  pillChevron: { fontSize: 22, color: '#94A3B8', marginLeft: 10 },

  // logout
  logoutBtn: { marginTop: 28, backgroundColor: '#60CCED', borderRadius: 14, paddingVertical: 18, alignItems: 'center' },
  logoutText: { fontSize: 17, color: '#FFFFFF', fontFamily: 'TTNormsPro-Regular' },
});

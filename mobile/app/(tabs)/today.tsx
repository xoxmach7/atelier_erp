import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, ScrollView, RefreshControl, Platform, StatusBar,
} from 'react-native';
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
interface OwnerCounters {
  new_orders: number; needs_measurement: number; needs_quote: number;
  materials_not_ready: number; in_sewing: number; on_installation: number;
  waiting_payment: number; paid_needs_completion: number; overdue: number;
}
interface OwnerQueueResponse { counters: OwnerCounters; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number) {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + ' млн ₸';
  if (v >= 1_000) return (v / 1_000).toFixed(0) + ' тыс ₸';
  return v + ' ₸';
}

// ─── Counter Row ──────────────────────────────────────────────────────────────

function CounterRow({
  label, value, valueColor, warn, onPress,
}: { label: string; value: number; valueColor?: string; warn?: boolean; onPress?: () => void }) {
  return (
    <TouchableOpacity style={s.counterRow} onPress={onPress} activeOpacity={onPress ? 0.6 : 1}>
      <View style={s.counterLeft}>
        <Text style={s.counterLabel}>{label}</Text>
        {warn && <Text style={s.warnIcon}> ⚠</Text>}
      </View>
      <View style={s.counterRight}>
        <Text style={[s.counterValue, valueColor ? { color: valueColor } : null]}>
          {value}
        </Text>
        {onPress && <Text style={s.arrow}> ›</Text>}
      </View>
    </TouchableOpacity>
  );
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────

function BarChart({ data, mode }: { data: ChartPoint[]; mode: 'revenue' | 'paid' | 'profit' }) {
  const maxValue = useMemo(() => {
    const vals = data.flatMap((d) => [d.revenue, d.paid]);
    return Math.max(...vals, 1);
  }, [data]);

  return (
    <View style={s.barsRow}>
      {data.map((point, i) => {
        const value = mode === 'paid' ? point.paid : point.revenue;
        const hp = maxValue > 0 ? (value / maxValue) * 100 : 0;
        const month = point.month.slice(5);
        return (
          <View key={i} style={s.barCol}>
            <View style={s.barWrap}>
              <View style={[s.bar, { height: `${Math.max(hp, 4)}%` as any }]} />
            </View>
            <Text style={s.barLabel}>{month}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Finance Row ──────────────────────────────────────────────────────────────

function FinanceRow({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={s.finRow}>
      <Text style={s.finLabel}>{label}</Text>
      <Text style={[s.finValue, color ? { color } : null]}>{fmt(value)}</Text>
    </View>
  );
}

// ─── Owner Dashboard ──────────────────────────────────────────────────────────

type ChartMode = 'revenue' | 'paid' | 'profit';

function OwnerDashboard() {
  const { user, logout } = useAuthContext();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>('revenue');

  const displayName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username
    : '';

  const fetchDashboard = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<DashboardResponse>('/api/v1/dashboard/');
      setData(res);
    } catch (err: any) {
      setError(err?.message ?? 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color="#60CCED" size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.centered}>
        <Text style={s.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => fetchDashboard()} style={s.retryBtn}>
          <Text style={s.retryText}>Повторить</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!data) return null;
  const { orders, finance, chart } = data;

  const toggleLabels: { key: ChartMode; label: string }[] = [
    { key: 'profit', label: 'Прибыль' },
    { key: 'revenue', label: 'Выручка' },
    { key: 'paid', label: 'Расходы' },
  ];

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={s.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchDashboard(true); }}
          tintColor="#60CCED"
        />
      }
    >
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.orgName}>Название организации</Text>
          <Text style={s.headerSub}>01.01.2025 - н.в.</Text>
        </View>
        <TouchableOpacity onPress={() => fetchDashboard()} style={s.refreshBtn}>
          <View style={s.refreshIcon}>
            <View style={s.refreshArc} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Counters as rows */}
      <View style={s.card}>
        <CounterRow label="Все заказы" value={orders.total} onPress={() => {}} />
        <View style={s.divider} />
        <CounterRow label="В работе" value={orders.in_work} valueColor="#3B82F6" onPress={() => {}} />
        <View style={s.divider} />
        <CounterRow
          label="Ожидают оплаты"
          value={orders.awaiting_payment}
          valueColor={orders.awaiting_payment > 0 ? '#F59E0B' : '#0F172A'}
          warn={orders.awaiting_payment > 0}
          onPress={() => {}}
        />
        <View style={s.divider} />
        <CounterRow
          label="Просрочено"
          value={orders.overdue}
          valueColor={orders.overdue > 0 ? '#EF4444' : '#0F172A'}
          warn={orders.overdue > 0}
          onPress={() => {}}
        />
        <View style={s.divider} />
        <CounterRow
          label="Материалы на исходе"
          value={0}
          valueColor="#F59E0B"
          onPress={() => {}}
        />
      </View>

      {/* Finance */}
      <View style={[s.card, { marginTop: 12 }]}>
        <FinanceRow label="Выручка" value={finance.total_revenue} />
        <View style={s.divider} />
        <FinanceRow label="Оплачено" value={finance.total_paid} color="#22C55E" />
        <View style={s.divider} />
        <FinanceRow label="Долг" value={finance.total_debt} color="#EF4444" />
        <View style={[s.divider, { marginVertical: 12 }]} />
        <View style={s.finMonthRow}>
          <View>
            <Text style={s.finMonthLabel}>В этом месяце</Text>
            <Text style={s.finMonthValue}>{fmt(finance.this_month_revenue)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.finMonthLabel}>Оплачено</Text>
            <Text style={[s.finMonthValue, { color: '#22C55E' }]}>{fmt(finance.this_month_paid)}</Text>
          </View>
        </View>
      </View>

      {/* Chart */}
      <View style={[s.card, { marginTop: 12 }]}>
        <View style={s.chartHeader}>
          <Text style={s.chartTitle}>6 месяцев</Text>
          <View style={s.toggleWrap}>
            {toggleLabels.map(({ key, label }) => {
              const active = chartMode === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => setChartMode(key)}
                  style={[s.toggleBtn, active && s.toggleBtnActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[s.toggleText, active ? s.toggleTextActive : s.toggleTextInactive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        <BarChart data={chart} mode={chartMode} />
      </View>

      {/* Totals */}
      <Text style={s.totals}>
        Всего заказов: {orders.total}  ·  Отменено: {orders.cancelled}
      </Text>

      {/* Logout - blue button per Figma */}
      <TouchableOpacity style={s.logoutBtnBlue} onPress={() => logout()} activeOpacity={0.85}>
        <Text style={s.logoutBtnText}>Выйти из профиля</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

// ─── Non-owner view (work queue) ──────────────────────────────────────────────

function NonOwnerView() {
  const { primaryRole, user, logout } = useAuthContext();
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
      contentContainerStyle={s.scrollContent}
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
  return primaryRole === 'owner' ? <OwnerDashboard /> : <NonOwnerView />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F2F4F7' },
  scrollContent: { padding: 16, paddingBottom: 32, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 8 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  errorText: { color: '#EF4444', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#F4F4F4', borderRadius: 8 },
  retryText: { fontSize: 14, color: '#0F172A', fontFamily: 'TTNormsPro-Medium' },

  // header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingTop: 8,
  },
  orgName: {
    fontSize: 20,
    fontFamily: 'TTNormsPro-Bold',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    color: '#94A3B8',
    fontFamily: 'TTNormsPro-Regular',
    marginTop: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'TTNormsPro-Bold',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  logoutSmall: {
    fontSize: 12,
    color: '#94A3B8',
    fontFamily: 'TTNormsPro-Regular',
    paddingTop: 6,
  },
  refreshBtn: { padding: 4 },
  refreshIcon: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  refreshArc: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: '#60CCED',
    borderTopColor: 'transparent',
  },

  // card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 10 },

  // counter rows
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  counterLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  counterRight: { flexDirection: 'row', alignItems: 'center' },
  counterLabel: { fontSize: 14, color: '#475569', fontFamily: 'TTNormsPro-Regular' },
  counterValue: { fontSize: 20, fontFamily: 'TTNormsPro-Bold', color: '#0F172A' },
  warnIcon: { fontSize: 13, color: '#F59E0B' },
  arrow: { fontSize: 20, color: '#94A3B8', marginLeft: 4 },

  // finance rows
  finRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  finLabel: { fontSize: 14, color: '#475569', fontFamily: 'TTNormsPro-Regular' },
  finValue: { fontSize: 16, fontFamily: 'TTNormsPro-Bold', color: '#0F172A' },
  finMonthRow: { flexDirection: 'row', justifyContent: 'space-between' },
  finMonthLabel: { fontSize: 12, color: '#94A3B8', fontFamily: 'TTNormsPro-Regular' },
  finMonthValue: { fontSize: 14, fontFamily: 'TTNormsPro-Bold', color: '#0F172A', marginTop: 2 },

  // chart
  chartHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  chartTitle: { fontSize: 15, fontFamily: 'TTNormsPro-Bold', color: '#0F172A' },
  toggleWrap: { flexDirection: 'row', gap: 4, backgroundColor: '#60CCED', borderRadius: 10, padding: 3 },
  toggleBtn: {
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: { fontSize: 11, fontFamily: 'TTNormsPro-Medium' },
  toggleTextActive: { color: '#0F172A' },
  toggleTextInactive: { color: '#FFFFFF' },

  // bars
  barsRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    justifyContent: 'space-between', height: 120, gap: 4,
  },
  barCol: { flex: 1, alignItems: 'center' },
  barWrap: { width: '100%', height: 100, justifyContent: 'flex-end' },
  bar: { width: '100%', backgroundColor: '#60CCED', borderRadius: 4, minHeight: 4 },
  barLabel: { fontSize: 10, color: '#94A3B8', marginTop: 4, fontFamily: 'TTNormsPro-Regular' },

  // totals
  totals: {
    marginTop: 16, textAlign: 'center',
    fontSize: 12, color: '#94A3B8', fontFamily: 'TTNormsPro-Regular',
  },

  // logout blue (Figma)
  logoutBtnBlue: {
    marginTop: 20,
    marginBottom: 8,
    backgroundColor: '#60CCED',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center' as const,
  },
  logoutBtnText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontFamily: 'TTNormsPro-Bold',
  },

});

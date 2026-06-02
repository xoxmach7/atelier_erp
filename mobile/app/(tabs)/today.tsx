import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { SummaryRow } from '../../src/components/SummaryRow';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useAuthContext } from '../../src/context/AuthContext';
import { apiClient } from '../../src/api/client';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

// ─── Types ───────────────────────────────────────────────────────────────────

interface OwnerCounters {
  new_orders: number;
  needs_measurement: number;
  needs_quote: number;
  materials_not_ready: number;
  in_sewing: number;
  on_installation: number;
  waiting_payment: number;
  paid_needs_completion: number;
  overdue: number;
}

interface OwnerQueueResponse {
  counters: OwnerCounters;
}

interface DashboardOrders {
  total: number;
  in_work: number;
  completed: number;
  cancelled: number;
  overdue: number;
  awaiting_payment: number;
}

interface DashboardFinance {
  total_revenue: number;
  total_paid: number;
  total_debt: number;
  this_month_revenue: number;
  this_month_paid: number;
}

interface ChartPoint {
  month: string;
  revenue: number;
  paid: number;
}

interface DashboardResponse {
  orders: DashboardOrders;
  finance: DashboardFinance;
  chart: ChartPoint[];
}

type WarningLevel = 'warning' | 'danger' | undefined;

function warn(n: number, level: 'warning' | 'danger' = 'warning'): WarningLevel {
  return n > 0 ? level : undefined;
}

function formatMoney(value: number): string {
  return value.toLocaleString('ru-RU') + ' ₸';
}

function formatShortMoney(value: number): string {
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + ' млн ₸';
  if (value >= 1_000) return (value / 1_000).toFixed(0) + ' тыс ₸';
  return value + ' ₸';
}

// ─── Counter Card ────────────────────────────────────────────────────────────

function CounterCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={counterStyles.card}>
      <Text style={[counterStyles.value, { color }]}>{value}</Text>
      <Text style={counterStyles.label}>{label}</Text>
    </View>
  );
}

const counterStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.base,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  value: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
  },
  label: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});

// ─── Simple Bar Chart ────────────────────────────────────────────────────────

function BarChart({
  data,
  mode,
}: {
  data: ChartPoint[];
  mode: 'revenue' | 'paid';
}) {
  const maxValue = useMemo(() => {
    const vals = data.flatMap((d) => [d.revenue, d.paid]);
    return Math.max(...vals, 1);
  }, [data]);

  const barColor = mode === 'revenue' ? colors.primary[500] : colors.success.DEFAULT;

  return (
    <View style={chartStyles.container}>
      <View style={chartStyles.barsRow}>
        {data.map((point, i) => {
          const value = mode === 'revenue' ? point.revenue : point.paid;
          const heightPercent = maxValue > 0 ? (value / maxValue) * 100 : 0;
          const monthLabel = point.month.slice(5); // "2026-01" → "01"
          return (
            <View key={i} style={chartStyles.barColumn}>
              <View style={chartStyles.barWrapper}>
                <View
                  style={[
                    chartStyles.bar,
                    {
                      height: `${Math.max(heightPercent, 4)}%`,
                      backgroundColor: barColor,
                    },
                  ]}
                />
              </View>
              <Text style={chartStyles.monthLabel}>{monthLabel}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 140,
    gap: spacing.sm,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
  },
  barWrapper: {
    width: '100%',
    height: 120,
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  monthLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});

// ─── Finance Block ───────────────────────────────────────────────────────────

function FinanceBlock({ finance }: { finance: DashboardFinance }) {
  return (
    <View style={financeStyles.block}>
      <View style={financeStyles.row}>
        <View style={financeStyles.item}>
          <Text style={financeStyles.bigValue}>{formatShortMoney(finance.total_revenue)}</Text>
          <Text style={financeStyles.bigLabel}>Выручка</Text>
        </View>
        <View style={financeStyles.item}>
          <Text style={[financeStyles.bigValue, { color: colors.success.DEFAULT }]}>
            {formatShortMoney(finance.total_paid)}
          </Text>
          <Text style={financeStyles.bigLabel}>Оплачено</Text>
        </View>
        <View style={financeStyles.item}>
          <Text style={[financeStyles.bigValue, { color: colors.danger.DEFAULT }]}>
            {formatShortMoney(finance.total_debt)}
          </Text>
          <Text style={financeStyles.bigLabel}>Долг</Text>
        </View>
      </View>
      <View style={financeStyles.divider} />
      <View style={financeStyles.row}>
        <View style={financeStyles.item}>
          <Text style={financeStyles.smallValue}>{formatMoney(finance.this_month_revenue)}</Text>
          <Text style={financeStyles.smallLabel}>В этом месяце</Text>
        </View>
        <View style={financeStyles.item}>
          <Text style={[financeStyles.smallValue, { color: colors.success.DEFAULT }]}>
            {formatMoney(finance.this_month_paid)}
          </Text>
          <Text style={financeStyles.smallLabel}>Оплачено в месяце</Text>
        </View>
      </View>
    </View>
  );
}

const financeStyles = StyleSheet.create({
  block: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  item: {
    alignItems: 'center',
    flex: 1,
  },
  bigValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  bigLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  smallValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  smallLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});

// ─── Owner Dashboard ─────────────────────────────────────────────────────────

function OwnerDashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<'revenue' | 'paid'>('revenue');

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<DashboardResponse>('/api/v1/dashboard/');
      setData(res);
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Не удалось загрузить данные';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={fetchDashboard} style={styles.retryBtn}>
          <Text style={styles.retryText}>Повторить</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!data) return null;

  const orders = data.orders;
  const finance = data.finance;

  return (
    <View>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.orgName}>Пульт владельца</Text>
        <View style={styles.underline} />
        <View style={styles.periodRow}>
          <Text style={styles.period}>Финансовый обзор</Text>
          <TouchableOpacity onPress={fetchDashboard}>
            <Text style={styles.periodAction}>Обновить</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Counter cards */}
      <View style={styles.countersRow}>
        <CounterCard label="В работе" value={orders.in_work} color={colors.info.DEFAULT} />
        <CounterCard label="Завершено" value={orders.completed} color={colors.success.DEFAULT} />
        <CounterCard label="Просрочено" value={orders.overdue} color={colors.danger.DEFAULT} />
        <CounterCard label="Ожидают оплату" value={orders.awaiting_payment} color={colors.warning.DEFAULT} />
      </View>

      {/* Finance block */}
      <FinanceBlock finance={finance} />

      {/* Chart */}
      <View style={styles.chartSection}>
        <View style={styles.chartHeader}>
          <Text style={styles.sectionTitle}>6 месяцев</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              onPress={() => setChartMode('revenue')}
              style={[styles.toggleBtn, chartMode === 'revenue' && styles.toggleBtnActive]}
            >
              <Text style={[styles.toggleText, chartMode === 'revenue' && styles.toggleTextActive]}>
                Выручка
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setChartMode('paid')}
              style={[styles.toggleBtn, chartMode === 'paid' && styles.toggleBtnActive]}
            >
              <Text style={[styles.toggleText, chartMode === 'paid' && styles.toggleTextActive]}>
                Оплачено
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <BarChart data={data.chart} mode={chartMode} />
      </View>

      {/* Summary totals */}
      <View style={styles.totalsRow}>
        <Text style={styles.totalsText}>
          Всего заказов: <Text style={styles.totalsBold}>{orders.total}</Text> ·
          Отменено: <Text style={styles.totalsBold}>{orders.cancelled}</Text>
        </Text>
      </View>
    </View>
  );
}

// ─── Non-owner queue view (existing) ─────────────────────────────────────────

function OwnerQueueView() {
  const [counters, setCounters] = useState<OwnerCounters | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCounters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<OwnerQueueResponse>('/api/v1/work/owner/');
      setCounters(data.counters);
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Не удалось загрузить данные';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCounters();
  }, [fetchCounters]);

  const summaryRows = counters
    ? [
        { label: 'Новые заказы', value: String(counters.new_orders) },
        { label: 'Нужен замер', value: String(counters.needs_measurement), warning: warn(counters.needs_measurement) },
        { label: 'Нужно КП', value: String(counters.needs_quote), warning: warn(counters.needs_quote) },
        { label: 'В производстве', value: String(counters.in_sewing) },
        { label: 'На установке', value: String(counters.on_installation) },
        { label: 'Ждут финального платежа', value: String(counters.waiting_payment), warning: warn(counters.waiting_payment) },
        { label: 'Материалы не готовы', value: String(counters.materials_not_ready), warning: warn(counters.materials_not_ready) },
        { label: 'Просрочено', value: String(counters.overdue), warning: warn(counters.overdue, 'danger') },
      ]
    : [];

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.orgName}>Текущие заказы</Text>
        <View style={styles.underline} />
        <View style={styles.periodRow}>
          <Text style={styles.period}>Рабочая очередь</Text>
          <TouchableOpacity onPress={fetchCounters}>
            <Text style={styles.periodAction}>Обновить</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.text} />
        </View>
      )}

      {Boolean(error) && !loading && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchCounters} style={styles.retryBtn}>
            <Text style={styles.retryText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && counters && (
        <View style={styles.summaryList}>
          {summaryRows.map((item) => (
            <SummaryRow key={item.label} {...item} />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function TodayScreen() {
  const { user, logout, primaryRole } = useAuthContext();
  const isOwner = primaryRole === 'owner';

  const displayName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username
    : 'Sheber ERP';

  return (
    <Screen>
      {isOwner ? <OwnerDashboard /> : <OwnerQueueView />}

      <View style={styles.bottomAction}>
        <Text style={styles.userName}>{displayName}</Text>
        <PrimaryButton title="Выйти" onPress={() => logout()} variant="secondary" />
      </View>
    </Screen>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
  },
  orgName: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.text,
    letterSpacing: -0.5,
  },
  underline: {
    height: 1,
    backgroundColor: colors.text,
    marginTop: 4,
    opacity: 0.15,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  period: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    fontWeight: typography.weights.medium,
  },
  periodAction: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  centered: {
    marginTop: spacing['2xl'],
    alignItems: 'center',
  },
  errorBox: {
    marginTop: spacing.lg,
    padding: spacing.base,
    backgroundColor: '#fff3f3',
    borderRadius: 8,
    gap: spacing.sm,
  },
  errorText: {
    fontSize: typography.sizes.sm,
    color: '#e53935',
  },
  retryBtn: {
    alignSelf: 'flex-start',
  },
  retryText: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    textDecorationLine: 'underline',
  },
  summaryList: {
    marginTop: spacing.sm,
  },
  countersRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chartSection: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  toggleBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
    backgroundColor: colors.neutral[100],
  },
  toggleBtnActive: {
    backgroundColor: colors.primary[100],
  },
  toggleText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  toggleTextActive: {
    color: colors.primary[700],
    fontWeight: typography.weights.bold,
  },
  totalsRow: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  totalsText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  totalsBold: {
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  bottomAction: {
    marginTop: spacing.lg,
    marginBottom: spacing['2xl'],
    gap: spacing.sm,
  },
  userName: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

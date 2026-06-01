import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { SummaryRow } from '../../src/components/SummaryRow';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useAuthContext } from '../../src/context/AuthContext';
import { apiClient } from '../../src/api/client';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

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

type WarningLevel = 'warning' | 'danger' | undefined;

function warn(n: number, level: 'warning' | 'danger' = 'warning'): WarningLevel {
  return n > 0 ? level : undefined;
}

export default function TodayScreen() {
  const { user, logout } = useAuthContext();
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

  const displayName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username
    : 'Sheber ERP';

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
    <Screen>
      <View style={styles.header}>
        <Text style={styles.orgName}>{displayName}</Text>
        <View style={styles.underline} />
        <View style={styles.periodRow}>
          <Text style={styles.period}>Текущие заказы</Text>
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

      <View style={styles.bottomAction}>
        <PrimaryButton title="Выйти" onPress={() => logout()} variant="secondary" />
      </View>
    </Screen>
  );
}

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
  bottomAction: {
    marginTop: spacing.lg,
    marginBottom: spacing['2xl'],
  },
});

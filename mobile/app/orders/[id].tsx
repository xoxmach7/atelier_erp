import { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthContext } from '../../src/context/AuthContext';
import {
  fetchOrderExecution,
  type OrderExecution,
} from '../../src/api/orders';
import { OrderSummaryCard } from '../../src/components/orders/OrderSummaryCard';
import { OrderMeasurements } from '../../src/components/orders/OrderMeasurements';
import { OrderRoleActions } from '../../src/components/orders/OrderRoleActions';
import { colors } from '../../src/theme/colors';
import { spacing, radius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

function Blocker({ text }: { text: string }) {
  return (
    <View style={styles.blockerRow}>
      <Text style={styles.blockerText}>⚠ {text}</Text>
    </View>
  );
}

export default function OrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { primaryRole } = useAuthContext();
  const [data, setData] = useState<OrderExecution | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const exec = await fetchOrderExecution(id as string);
      setData(exec);
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e
        ? String((e as { message: string }).message)
        : 'Не удалось загрузить заказ';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const doAction = useCallback(async (
    action: () => Promise<unknown>,
    successMsg: string,
  ) => {
    setActionLoading(true);
    try {
      await action();
      Alert.alert('Готово', successMsg);
      await load();
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e
        ? String((e as { message: string }).message)
        : 'Ошибка действия';
      Alert.alert('Ошибка', msg);
    } finally {
      setActionLoading(false);
    }
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary[500]} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Заказ не найден'}</Text>
        <TouchableOpacity onPress={load} style={{ marginTop: spacing.base }}>
          <Text style={styles.retryText}>Повторить</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const idStr = id as string;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.back}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.orderNum}>{data.order_number}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* Blockers */}
        {data.blockers?.map((b, i) => <Blocker key={i} text={b} />)}

        <OrderSummaryCard data={data} />
        <OrderMeasurements data={data} />

        {/* Measurements link */}
        {(primaryRole === 'owner' || primaryRole === 'designer') && (
          <TouchableOpacity
            style={styles.measurementsLink}
            onPress={() => router.push(`/orders/${idStr}/measurements`)}
            activeOpacity={0.7}
          >
            <Text style={styles.measurementsLinkText}>📐 Замеры</Text>
            <Text style={styles.measurementsLinkArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* Quote link */}
        {(primaryRole === 'owner' || primaryRole === 'designer') && (
          <TouchableOpacity
            style={styles.measurementsLink}
            onPress={() => router.push(`/orders/${idStr}/quote`)}
            activeOpacity={0.7}
          >
            <Text style={styles.measurementsLinkText}>📝 Коммерческое предложение</Text>
            <Text style={styles.measurementsLinkArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* Materials link — visible to all */}
        <TouchableOpacity
          style={styles.measurementsLink}
          onPress={() => router.push(`/orders/${idStr}/materials`)}
          activeOpacity={0.7}
        >
          <Text style={styles.measurementsLinkText}>📦 Материалы</Text>
          <Text style={styles.measurementsLinkArrow}>→</Text>
        </TouchableOpacity>

        {/* Warnings */}
        {data.warnings?.length > 0 && (
          <View style={styles.warningsBox}>
            {data.warnings.map((w, i) => (
              <Text key={i} style={styles.warningText}>• {w}</Text>
            ))}
          </View>
        )}

        {/* Role-based actions */}
        {actionLoading ? (
          <View style={styles.actionsBox}>
            <ActivityIndicator color={colors.primary[500]} />
          </View>
        ) : (
          <OrderRoleActions
            idStr={idStr}
            data={data}
            role={primaryRole}
            doAction={doAction}
          />
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8f9fa' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.base },
  errorText: { fontSize: typography.sizes.base, color: '#e53935', textAlign: 'center' },
  retryText: { fontSize: typography.sizes.base, color: colors.primary[500], textDecorationLine: 'underline' },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  back: { fontSize: typography.sizes.base, color: colors.primary[500] },
  orderNum: { fontSize: typography.sizes.lg, fontWeight: '500', color: colors.text, flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.base, paddingBottom: 60 },
  blockerRow: {
    backgroundColor: '#fff3f3',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  blockerText: { fontSize: typography.sizes.sm, color: '#dc2626' },
  warningsBox: {
    backgroundColor: '#fffbeb',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  warningText: { fontSize: typography.sizes.sm, color: '#92400e', marginBottom: 2 },
  actionsBox: { paddingVertical: spacing.sm, gap: spacing.sm },
  measurementsLink: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  measurementsLinkText: { fontSize: typography.sizes.base, fontWeight: '500', color: colors.text },
  measurementsLinkArrow: { fontSize: typography.sizes.lg, color: colors.primary[500] },
});

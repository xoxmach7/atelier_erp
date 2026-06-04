import { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, StyleSheet, Platform, StatusBar } from 'react-native';
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
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.orderNum}>{data.order_number}</Text>
        <View style={{width:36}}/>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* Blockers */}
        {data.blockers?.map((b, i) => <Blocker key={i} text={b} />)}

        <OrderSummaryCard data={data} />
        <OrderMeasurements data={data} />

        {/* Edit link — owner and designer */}
        {(primaryRole === 'owner' || primaryRole === 'designer') && (
          <TouchableOpacity
            style={styles.measurementsLink}
            onPress={() => router.push(`/orders/${idStr}/edit`)}
            activeOpacity={0.7}
          >
            <Text style={styles.measurementsLinkText}>Редактировать</Text>
            <Text style={styles.measurementsLinkArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* Measurements link */}
        {(primaryRole === 'owner' || primaryRole === 'designer') && (
          <TouchableOpacity
            style={styles.measurementsLink}
            onPress={() => router.push(`/orders/${idStr}/measurements`)}
            activeOpacity={0.7}
          >
            <Text style={styles.measurementsLinkText}>Замеры</Text>
            <Text style={styles.measurementsLinkArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* Quote link */}
        {(primaryRole === 'owner' || primaryRole === 'designer') && (
          <TouchableOpacity
            style={styles.measurementsLink}
            onPress={() => router.push(`/orders/${idStr}/quote`)}
            activeOpacity={0.7}
          >
            <Text style={styles.measurementsLinkText}>Коммерческое предложение</Text>
            <Text style={styles.measurementsLinkArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* Materials link — visible to all */}
        <TouchableOpacity
          style={styles.measurementsLink}
          onPress={() => router.push(`/orders/${idStr}/materials`)}
          activeOpacity={0.7}
        >
          <Text style={styles.measurementsLinkText}>Материалы</Text>
          <Text style={styles.measurementsLinkArrow}>›</Text>
        </TouchableOpacity>

        {/* Photos link — installation and owner */}
        {(primaryRole === 'installation' || primaryRole === 'owner') && (
          <TouchableOpacity
            style={styles.measurementsLink}
            onPress={() => router.push(`/orders/${idStr}/photos`)}
            activeOpacity={0.7}
          >
            <Text style={styles.measurementsLinkText}>Фотоотчёт</Text>
            <Text style={styles.measurementsLinkArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* Act link — installation and owner */}
        {(primaryRole === 'installation' || primaryRole === 'owner') && (
          <TouchableOpacity
            style={styles.measurementsLink}
            onPress={() => router.push(`/orders/${idStr}/act`)}
            activeOpacity={0.7}
          >
            <Text style={styles.measurementsLinkText}>АВР (Акт выполненных работ)</Text>
            <Text style={styles.measurementsLinkArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* Complete order link — owner only */}
        {primaryRole === 'owner' && data.actions?.can_complete && (
          <TouchableOpacity
            style={[styles.measurementsLink, { backgroundColor: '#ecfdf5' }]}
            onPress={() => router.push(`/orders/${idStr}/complete`)}
            activeOpacity={0.7}
          >
            <Text style={[styles.measurementsLinkText, { color: '#059669' }]}>Завершить заказ</Text>
            <Text style={styles.measurementsLinkArrow}>›</Text>
          </TouchableOpacity>
        )}

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
  root: { flex: 1, backgroundColor: '#F2F4F7' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  errorText: { fontSize: 14, color: '#EF4444', textAlign: 'center' },
  retryText: { fontSize: 14, color: '#60CCED', textDecorationLine: 'underline' },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: { fontSize: 26, color: '#60CCED', lineHeight: 30, width: 36 },
  orderNum: { fontSize: 17, fontFamily: 'TTNormsPro-Bold', color: '#0F172A' },
  backLabel: { fontSize: 12, color: '#94A3B8', fontFamily: 'TTNormsPro-Regular', width: 36, textAlign: 'right' },
  scroll: { flex: 1 },
  scrollContent: { padding: 14, paddingBottom: 60 },
  blockerRow: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  blockerText: { fontSize: 13, color: '#DC2626', fontFamily: 'TTNormsPro-Regular', flex: 1 },
  warningsBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  warningText: { fontSize: 13, color: '#92400E', marginBottom: 2, fontFamily: 'TTNormsPro-Regular' },
  actionsBox: { paddingVertical: 8, gap: 8 },
  measurementsLink: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  measurementsLinkText: { fontSize: 15, fontFamily: 'TTNormsPro-Medium', color: '#0F172A' },
  measurementsLinkArrow: { fontSize: 20, color: '#60CCED' },
});

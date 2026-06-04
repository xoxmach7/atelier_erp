import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../../src/components/Screen';
import { useAuthContext } from '../../../src/context/AuthContext';
import {
  fetchCompletionChecklist, changeOrderStatus,
  type CompletionChecklist,
} from '../../../src/api/orders';
import { colors } from '../../../src/theme/colors';
import { spacing, radius } from '../../../src/theme/spacing';
import { typography } from '../../../src/theme/typography';

export default function OrderCompleteScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { primaryRole } = useAuthContext();
  const orderId = id as string;

  const [data, setData] = useState<CompletionChecklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAccess = primaryRole === 'owner';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCompletionChecklist(orderId);
      setData(result);
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e
        ? String((e as { message: string }).message)
        : 'Не удалось загрузить чеклист';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleComplete = async () => {
    if (!data?.can_complete) return;
    setCompleting(true);
    try {
      await changeOrderStatus(orderId, 'completed');
      Alert.alert('Готово', 'Заказ завершён', [
        { text: 'OK', onPress: () => router.replace('/orders') },
      ]);
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e
        ? String((e as { message: string }).message)
        : 'Не удалось завершить заказ';
      Alert.alert('Ошибка', msg);
    } finally {
      setCompleting(false);
    }
  };

  if (!canAccess) {
    return (
      <Screen scrollable={false} withPadding={false}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Доступ запрещён</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scrollable={false} withPadding={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.back}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Завершение заказа</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary[500]} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={{ marginTop: spacing.base }}>
            <Text style={styles.retryText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Чеклист завершения</Text>
            {data?.checklist.map((item) => (
              <View key={item.key} style={styles.row}>
                <Text style={styles.icon}>{item.done ? '✅' : '❌'}</Text>
                <Text style={[styles.label, !item.done && styles.labelPending]}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[
              styles.completeBtn,
              (!data?.can_complete || completing) && styles.completeBtnDisabled,
            ]}
            onPress={handleComplete}
            disabled={!data?.can_complete || completing}
            activeOpacity={0.8}
          >
            {completing ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.completeBtnText}>✓ Завершить заказ</Text>
            )}
          </TouchableOpacity>

          {!data?.can_complete && (
            <Text style={styles.hint}>
              Выполните все пункты чеклиста, чтобы завершить заказ
            </Text>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  title: { fontSize: typography.sizes.lg, fontWeight: '500', color: colors.text, flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.base },
  errorText: { fontSize: typography.sizes.base, color: colors.danger.DEFAULT, textAlign: 'center' },
  retryText: { fontSize: typography.sizes.base, color: colors.primary[500], textDecorationLine: 'underline' },
  scrollContent: { padding: spacing.base, paddingBottom: 60, gap: spacing.base },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: spacing.base,
    gap: spacing.sm,
  },
  cardTitle: { fontSize: typography.sizes.lg, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  icon: { fontSize: 20 },
  label: { fontSize: typography.sizes.base, color: colors.text, flex: 1 },
  labelPending: { color: colors.textMuted },
  completeBtn: {
    backgroundColor: colors.success.DEFAULT || '#10b981',
    borderRadius: radius.lg,
    padding: spacing.base,
    alignItems: 'center',
  },
  completeBtnDisabled: { backgroundColor: '#9ca3af' },
  completeBtnText: { color: colors.white, fontSize: typography.sizes.base, fontWeight: '600' },
  hint: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

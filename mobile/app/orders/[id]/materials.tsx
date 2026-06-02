import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../../src/components/Screen';
import { useAuthContext } from '../../../src/context/AuthContext';
import {
  fetchMaterials, updateMaterial, fetchOrderExecution,
  type OrderMaterialDTO, type OrderExecution,
} from '../../../src/api/orders';
import { colors } from '../../../src/theme/colors';
import { spacing, radius } from '../../../src/theme/spacing';
import { typography } from '../../../src/theme/typography';

const STATUS_COLORS: Record<string, string> = {
  to_buy: colors.danger.DEFAULT,
  partial: '#f59e0b',
  ready: colors.success.DEFAULT,
};

const STATUS_EMOJIS: Record<string, string> = {
  to_buy: '🔴',
  partial: '🟡',
  ready: '🟢',
};

export default function OrderMaterialsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { primaryRole } = useAuthContext();
  const orderId = id as string;

  const [materials, setMaterials] = useState<OrderMaterialDTO[]>([]);
  const [readinessLabel, setReadinessLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedMaterial, setSelectedMaterial] = useState<OrderMaterialDTO | null>(null);
  const [modalStatus, setModalStatus] = useState('');
  const [modalComment, setModalComment] = useState('');
  const [updating, setUpdating] = useState(false);

  const canEdit = primaryRole === 'warehouse' || primaryRole === 'owner';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [matData, execData] = await Promise.all([
        fetchMaterials(orderId),
        fetchOrderExecution(orderId),
      ]);
      setMaterials(matData.results);
      setReadinessLabel(execData.material_readiness_label || '');
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e
        ? String((e as { message: string }).message)
        : 'Не удалось загрузить материалы';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openModal = (item: OrderMaterialDTO) => {
    if (!canEdit) return;
    setSelectedMaterial(item);
    setModalStatus(item.status);
    setModalComment(item.comment || '');
  };

  const handleUpdate = async () => {
    if (!selectedMaterial) return;
    setUpdating(true);
    try {
      const res = await updateMaterial(orderId, selectedMaterial.id, {
        status: modalStatus,
        comment: modalComment,
      });
      setMaterials(prev =>
        prev.map(m => (m.id === selectedMaterial.id ? res.material : m))
      );
      setReadinessLabel(res.order_material_readiness_label);
      setSelectedMaterial(null);
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e
        ? String((e as { message: string }).message)
        : 'Ошибка обновления';
      Alert.alert('Ошибка', msg);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Screen scrollable={false} withPadding={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.back}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Материалы</Text>
      </View>

      {readinessLabel && (
        <View style={styles.readinessCard}>
          <Text style={styles.readinessLabel}>Обеспеченность заказа</Text>
          <Text style={styles.readinessValue}>{readinessLabel}</Text>
        </View>
      )}

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
          {materials.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Материалы ещё не созданы</Text>
              <Text style={styles.emptySub}>Появятся автоматически после перевода заказа в работу</Text>
            </View>
          ) : (
            materials.map(item => (
              <TouchableOpacity
                key={item.id}
                style={styles.row}
                onPress={() => openModal(item)}
                activeOpacity={canEdit ? 0.7 : 1}
              >
                <View style={styles.rowLeft}>
                  <Text style={styles.rowName}>{item.name}</Text>
                  <Text style={styles.rowType}>{item.material_type} · {item.quantity} {item.unit}</Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={[styles.statusBadge, { color: STATUS_COLORS[item.status] }]}>
                    {STATUS_EMOJIS[item.status]} {item.status_display}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      <Modal
        visible={!!selectedMaterial}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedMaterial(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Статус материала</Text>
            <Text style={styles.modalSubtitle}>{selectedMaterial?.name}</Text>

            <View style={styles.statusOptions}>
              {(['to_buy', 'partial', 'ready'] as const).map(s => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.statusOption,
                    modalStatus === s && { borderColor: STATUS_COLORS[s], backgroundColor: STATUS_COLORS[s] + '15' },
                  ]}
                  onPress={() => setModalStatus(s)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.statusOptionText, { color: STATUS_COLORS[s] }]}>
                    {STATUS_EMOJIS[s]} {s === 'to_buy' ? 'Закупить' : s === 'partial' ? 'Частично' : 'Готово'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Комментарий</Text>
              <TextInput
                style={styles.input}
                value={modalComment}
                onChangeText={setModalComment}
                placeholder="Комментарий..."
                multiline
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.saveBtn, updating && styles.saveBtnDisabled]}
                onPress={handleUpdate}
                disabled={updating}
                activeOpacity={0.8}
              >
                {updating ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Сохранить</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setSelectedMaterial(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Отмена</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  readinessCard: {
    backgroundColor: colors.primary[50],
    marginHorizontal: spacing.base,
    marginTop: spacing.base,
    borderRadius: radius.lg,
    padding: spacing.base,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  readinessLabel: { fontSize: typography.sizes.sm, color: colors.textMuted },
  readinessValue: { fontSize: typography.sizes.base, fontWeight: '600', color: colors.primary[500] },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.base },
  errorText: { fontSize: typography.sizes.base, color: colors.danger.DEFAULT, textAlign: 'center' },
  retryText: { fontSize: typography.sizes.base, color: colors.primary[500], textDecorationLine: 'underline' },
  scrollContent: { padding: spacing.base, paddingBottom: 60, gap: spacing.sm },
  emptyBox: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: { fontSize: typography.sizes.base, color: colors.textMuted },
  emptySub: { fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
  row: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: { flex: 1, gap: 2 },
  rowRight: { marginLeft: spacing.base },
  rowName: { fontSize: typography.sizes.base, fontWeight: '500', color: colors.text },
  rowType: { fontSize: typography.sizes.sm, color: colors.textMuted },
  statusBadge: { fontSize: typography.sizes.sm, fontWeight: '500' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: 40,
    gap: spacing.base,
  },
  modalTitle: { fontSize: typography.sizes.lg, fontWeight: '600', color: colors.text },
  modalSubtitle: { fontSize: typography.sizes.base, color: colors.textMuted },
  statusOptions: { gap: spacing.sm },
  statusOption: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  statusOptionText: { fontSize: typography.sizes.base, fontWeight: '500' },
  field: { gap: spacing.xs },
  label: { fontSize: typography.sizes.sm, fontWeight: '500', color: colors.textMuted },
  input: {
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.text,
    minHeight: 44,
  },
  modalActions: { flexDirection: 'row', gap: spacing.base, marginTop: spacing.sm },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.primary[500],
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: colors.white, fontSize: typography.sizes.base, fontWeight: '500' },
  cancelBtn: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: { color: colors.textMuted, fontSize: typography.sizes.base },
});

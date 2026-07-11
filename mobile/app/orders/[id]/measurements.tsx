import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../../src/components/Screen';
import { useAuthContext } from '../../../src/context/AuthContext';
import { fetchMeasurements, createMeasurement, type MeasurementPayload } from '../../../src/api/orders';
import { colors } from '../../../src/theme/colors';
import { spacing, radius } from '../../../src/theme/spacing';
import { typography } from '../../../src/theme/typography';

interface MeasurementForm {
  room_name: string;
  window_number: string;
  width: string;
  height: string;
  curtain_fabric_name: string;
  curtain_gathering: string;
  tulle_fabric_name: string;
  tulle_gathering: string;
  mounting_type: string;
  comment: string;
}

const DEFAULT_CURTAIN_GATHERING = '2.2';
const DEFAULT_TULLE_GATHERING = '2.0';

// Живое превью метража = ceil_0.1(ширина × сборка / 100). Источник истины — сервер.
function previewMeters(widthCm: string, gathering: string): string {
  const w = parseFloat(widthCm);
  const g = parseFloat(gathering);
  if (!w || !g) return '';
  return (Math.ceil((w * g) / 100 * 10) / 10).toFixed(1);
}

export default function MeasurementsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { primaryRole } = useAuthContext();
  const orderId = id as string;

  const [measurements, setMeasurements] = useState<NonNullable<ReturnType<typeof fetchMeasurements> extends Promise<infer R> ? R : never>['results']>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<MeasurementForm>({
    room_name: '',
    window_number: '',
    width: '',
    height: '',
    curtain_fabric_name: '',
    curtain_gathering: DEFAULT_CURTAIN_GATHERING,
    tulle_fabric_name: '',
    tulle_gathering: DEFAULT_TULLE_GATHERING,
    mounting_type: '',
    comment: '',
  });

  const canEdit = primaryRole === 'owner' || primaryRole === 'designer';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMeasurements(orderId);
      setMeasurements(data.results);
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e
        ? String((e as { message: string }).message)
        : 'Не удалось загрузить замеры';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSubmit = async () => {
    if (!form.room_name.trim() || !form.width.trim() || !form.height.trim()) {
      Alert.alert('Ошибка', 'Заполните обязательные поля: комната, ширина, высота');
      return;
    }

    const widthNum = parseFloat(form.width);
    const heightNum = parseFloat(form.height);
    if (Number.isNaN(widthNum) || widthNum <= 0 || Number.isNaN(heightNum) || heightNum <= 0) {
      Alert.alert('Ошибка', 'Ширина и высота должны быть положительными числами');
      return;
    }

    setSubmitting(true);
    try {
      const payload: MeasurementPayload = {
        room_name: form.room_name.trim(),
        window_number: form.window_number.trim() || undefined,
        width: widthNum,
        height: heightNum,
        mounting_type: form.mounting_type.trim() || undefined,
        comment: form.comment.trim() || undefined,
        curtain_fabric_name: form.curtain_fabric_name.trim() || undefined,
        curtain_gathering: form.curtain_fabric_name.trim() ? form.curtain_gathering : undefined,
        tulle_fabric_name: form.tulle_fabric_name.trim() || undefined,
        tulle_gathering: form.tulle_fabric_name.trim() ? form.tulle_gathering : undefined,
      };

      await createMeasurement(orderId, payload);
      await load();
      setShowForm(false);
      setForm({
        room_name: '',
        window_number: '',
        width: '',
        height: '',
        curtain_fabric_name: '',
        curtain_gathering: DEFAULT_CURTAIN_GATHERING,
        tulle_fabric_name: '',
        tulle_gathering: DEFAULT_TULLE_GATHERING,
        mounting_type: '',
        comment: '',
      });
      Alert.alert('Готово', 'Замер добавлен');
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e
        ? String((e as { message: string }).message)
        : 'Не удалось сохранить замер';
      Alert.alert('Ошибка', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scrollable={false} withPadding={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.back}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Замеры</Text>
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
          {/* Existing measurements */}
          {measurements.length === 0 && !showForm && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Замеры ещё не добавлены</Text>
            </View>
          )}

          {measurements.map((m, i) => (
            <View key={m.id ?? i} style={styles.card}>
              <Text style={styles.cardTitle}>{m.room_name}{m.window_name ? ` — ${m.window_name}` : ''}</Text>
              <Text style={styles.cardRow}>Размеры: {m.width_cm} × {m.height_cm} см</Text>
              {m.mounting_type ? <Text style={styles.cardRow}>Крепление: {m.mounting_type}</Text> : null}
              {m.curtain_fabric ? (
                <Text style={styles.cardRow}>Ткань: {m.curtain_fabric}{m.curtain_meters ? ` (${m.curtain_meters} м)` : ''}</Text>
              ) : null}
              {m.tulle_fabric ? (
                <Text style={styles.cardRow}>Тюль: {m.tulle_fabric}{m.tulle_meters ? ` (${m.tulle_meters} м)` : ''}</Text>
              ) : null}
              {m.notes ? <Text style={styles.cardRow}>Комментарий: {m.notes}</Text> : null}
            </View>
          ))}

          {/* Add button */}
          {canEdit && !showForm && (
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)} activeOpacity={0.8}>
              <Text style={styles.addBtnText}>+ Добавить замер</Text>
            </TouchableOpacity>
          )}

          {/* Form */}
          {showForm && (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Новый замер</Text>

              <View style={styles.field}>
                <Text style={styles.label}>Комната *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Гостиная"
                  placeholderTextColor={colors.textMuted}
                  value={form.room_name}
                  onChangeText={v => setForm(p => ({ ...p, room_name: v }))}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Окно</Text>
                <TextInput
                  style={styles.input}
                  placeholder="1"
                  placeholderTextColor={colors.textMuted}
                  value={form.window_number}
                  onChangeText={v => setForm(p => ({ ...p, window_number: v }))}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>Ширина (см) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="150"
                    placeholderTextColor={colors.textMuted}
                    value={form.width}
                    onChangeText={v => setForm(p => ({ ...p, width: v }))}
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.field, { flex: 1, marginLeft: spacing.base }]}>
                  <Text style={styles.label}>Высота (см) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="200"
                    placeholderTextColor={colors.textMuted}
                    value={form.height}
                    onChangeText={v => setForm(p => ({ ...p, height: v }))}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Ткань штор</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Название ткани"
                  placeholderTextColor={colors.textMuted}
                  value={form.curtain_fabric_name}
                  onChangeText={v => setForm(p => ({ ...p, curtain_fabric_name: v }))}
                />
                {form.curtain_fabric_name.trim() ? (
                  <View style={styles.gatheringRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="Сборка (2.2)"
                      placeholderTextColor={colors.textMuted}
                      value={form.curtain_gathering}
                      onChangeText={v => setForm(p => ({ ...p, curtain_gathering: v }))}
                      keyboardType="numeric"
                    />
                    {previewMeters(form.width, form.curtain_gathering) ? (
                      <Text style={styles.metersHint}>≈ {previewMeters(form.width, form.curtain_gathering)} м</Text>
                    ) : null}
                  </View>
                ) : null}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Ткань тюля</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Название ткани"
                  placeholderTextColor={colors.textMuted}
                  value={form.tulle_fabric_name}
                  onChangeText={v => setForm(p => ({ ...p, tulle_fabric_name: v }))}
                />
                {form.tulle_fabric_name.trim() ? (
                  <View style={styles.gatheringRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="Сборка (2.0)"
                      placeholderTextColor={colors.textMuted}
                      value={form.tulle_gathering}
                      onChangeText={v => setForm(p => ({ ...p, tulle_gathering: v }))}
                      keyboardType="numeric"
                    />
                    {previewMeters(form.width, form.tulle_gathering) ? (
                      <Text style={styles.metersHint}>≈ {previewMeters(form.width, form.tulle_gathering)} м</Text>
                    ) : null}
                  </View>
                ) : null}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Тип крепления</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Потолочный карниз"
                  placeholderTextColor={colors.textMuted}
                  value={form.mounting_type}
                  onChangeText={v => setForm(p => ({ ...p, mounting_type: v }))}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Комментарий</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Примечания..."
                  placeholderTextColor={colors.textMuted}
                  value={form.comment}
                  onChangeText={v => setForm(p => ({ ...p, comment: v }))}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.formActions}>
                <TouchableOpacity
                  style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={submitting}
                  activeOpacity={0.8}
                >
                  {submitting ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>Сохранить</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setShowForm(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>Отмена</Text>
                </TouchableOpacity>
              </View>
            </View>
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
  scrollContent: { padding: spacing.base, paddingBottom: 60, gap: spacing.sm },
  emptyBox: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: { fontSize: typography.sizes.base, color: colors.textMuted },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: spacing.base,
    gap: spacing.xs,
  },
  cardTitle: { fontSize: typography.sizes.base, fontWeight: '500', color: colors.text },
  cardRow: { fontSize: typography.sizes.sm, color: colors.textMuted },
  addBtn: {
    backgroundColor: colors.primary[500],
    borderRadius: radius.lg,
    padding: spacing.base,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  addBtnText: { color: colors.white, fontSize: typography.sizes.base, fontWeight: '500' },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: spacing.base,
    gap: spacing.base,
    marginTop: spacing.sm,
  },
  formTitle: { fontSize: typography.sizes.lg, fontWeight: '500', color: colors.text },
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
  },
  textArea: { minHeight: 70, paddingTop: spacing.md },
  row: { flexDirection: 'row' },
  gatheringRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  metersHint: { fontSize: typography.sizes.sm, color: colors.primary[500], fontWeight: '500' },
  chipRow: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  chipText: { fontSize: typography.sizes.sm, color: colors.text },
  chipTextActive: { color: colors.white, fontWeight: '500' },
  formActions: { flexDirection: 'row', gap: spacing.base, marginTop: spacing.sm },
  submitBtn: {
    flex: 1,
    backgroundColor: colors.primary[500],
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: colors.white, fontSize: typography.sizes.base, fontWeight: '500' },
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

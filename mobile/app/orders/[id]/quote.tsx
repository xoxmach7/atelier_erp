import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../../src/components/Screen';
import { useAuthContext } from '../../../src/context/AuthContext';
import {
  fetchQuotes, createQuote, generateQuotePdf, fetchMeasurements,
  type QuoteDTO, type QuoteItemPayload, type CreateQuotePayload,
} from '../../../src/api/orders';
import { colors } from '../../../src/theme/colors';
import { spacing, radius } from '../../../src/theme/spacing';
import { typography } from '../../../src/theme/typography';

interface QuoteFormItem {
  room_name: string;
  window_name: string;
  window_width_cm: number;
  window_height_cm: number;
  fabric_meters: string;
  fabric_cost: string;
  tulle_meters: string;
  tulle_cost: string;
  sewing_cost: string;
  installation_price: string;
  accessories_cost: string;
  line_total: string;
}

function formatMoney(v: string | number | undefined): string {
  if (v === undefined || v === null) return '-';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (Number.isNaN(n)) return '-';
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function QuoteScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { primaryRole } = useAuthContext();
  const orderId = id as string;

  const [quotes, setQuotes] = useState<QuoteDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [validUntil, setValidUntil] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [installationCost, setInstallationCost] = useState('');
  const [deliveryCost, setDeliveryCost] = useState('');
  const [prepaymentPercent, setPrepaymentPercent] = useState('50');
  const [formItems, setFormItems] = useState<QuoteFormItem[]>([]);

  const canEdit = primaryRole === 'owner' || primaryRole === 'designer';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchQuotes(orderId);
      setQuotes(data.results);
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e
        ? String((e as { message: string }).message)
        : 'Не удалось загрузить КП';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const initFormFromMeasurements = async () => {
    try {
      const mData = await fetchMeasurements(orderId);
      const items: QuoteFormItem[] = mData.results.map(m => ({
        room_name: m.room_name,
        window_name: m.window_name || '',
        window_width_cm: m.width_cm,
        window_height_cm: m.height_cm,
        fabric_meters: m.curtain_meters ? String(m.curtain_meters) : '',
        fabric_cost: '',
        tulle_meters: m.tulle_meters ? String(m.tulle_meters) : '',
        tulle_cost: '',
        sewing_cost: '',
        installation_price: '',
        accessories_cost: '',
        line_total: '',
      }));
      setFormItems(items);
      setShowForm(true);
    } catch (e: unknown) {
      Alert.alert('Ошибка', 'Не удалось загрузить замеры для формы');
    }
  };

  const updateItem = (index: number, field: keyof QuoteFormItem, value: string) => {
    setFormItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      // Auto-calculate line_total
      const item = next[index];
      const fabricCost = parseFloat(item.fabric_cost) || 0;
      const tulleCost = parseFloat(item.tulle_cost) || 0;
      const sewingCost = parseFloat(item.sewing_cost) || 0;
      const installPrice = parseFloat(item.installation_price) || 0;
      const accessoriesCost = parseFloat(item.accessories_cost) || 0;
      const total = fabricCost + tulleCost + sewingCost + installPrice + accessoriesCost;
      next[index].line_total = total > 0 ? String(total) : '';
      return next;
    });
  };

  const calculateGrandTotal = (): number => {
    const itemsTotal = formItems.reduce((sum, item) => sum + (parseFloat(item.line_total) || 0), 0);
    const install = parseFloat(installationCost) || 0;
    const delivery = parseFloat(deliveryCost) || 0;
    const discount = parseFloat(discountAmount) || 0;
    return itemsTotal + install + delivery - discount;
  };

  const handleSubmit = async () => {
    const items: QuoteItemPayload[] = formItems.map(item => ({
      room_name: item.room_name,
      window_name: item.window_name || undefined,
      window_width_cm: item.window_width_cm,
      window_height_cm: item.window_height_cm,
      fabric_meters: item.fabric_meters ? parseFloat(item.fabric_meters) : undefined,
      fabric_cost: item.fabric_cost ? parseFloat(item.fabric_cost) : undefined,
      tulle_meters: item.tulle_meters ? parseFloat(item.tulle_meters) : undefined,
      tulle_cost: item.tulle_cost ? parseFloat(item.tulle_cost) : undefined,
      sewing_cost: item.sewing_cost ? parseFloat(item.sewing_cost) : undefined,
      installation_price: item.installation_price ? parseFloat(item.installation_price) : undefined,
      accessories_cost: item.accessories_cost ? parseFloat(item.accessories_cost) : undefined,
      line_total: parseFloat(item.line_total) || 0,
    }));

    if (items.length === 0 || items.some(i => !i.room_name || i.line_total === undefined)) {
      Alert.alert('Ошибка', 'Заполните все позиции и итоги');
      return;
    }

    const payload: CreateQuotePayload = {
      order_id: orderId,
      items,
      valid_until: validUntil || undefined,
      discount_amount: discountAmount ? parseFloat(discountAmount) : undefined,
      installation_cost: installationCost ? parseFloat(installationCost) : undefined,
      delivery_cost: deliveryCost ? parseFloat(deliveryCost) : undefined,
      prepayment_percent: prepaymentPercent ? parseFloat(prepaymentPercent) / 100 : undefined,
    };

    setSubmitting(true);
    try {
      await createQuote(payload);
      await load();
      setShowForm(false);
      Alert.alert('Готово', 'КП создано');
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e
        ? String((e as { message: string }).message)
        : 'Не удалось создать КП';
      Alert.alert('Ошибка', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGeneratePdf = async (quoteId: string) => {
    try {
      const res = await generateQuotePdf(quoteId);
      if (res.pdf_url) {
        const baseUrl = 'http://10.0.2.2:8000';
        await Linking.openURL(`${baseUrl}${res.pdf_url}`);
      } else {
        Alert.alert('Ошибка', 'PDF не сгенерирован');
      }
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e
        ? String((e as { message: string }).message)
        : 'Ошибка генерации PDF';
      Alert.alert('Ошибка', msg);
    }
  };

  return (
    <Screen scrollable={false} withPadding={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.back}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Коммерческое предложение</Text>
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
          {!showForm && quotes.length === 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>КП ещё не создано</Text>
              {canEdit && (
                <TouchableOpacity style={styles.addBtn} onPress={initFormFromMeasurements} activeOpacity={0.8}>
                  <Text style={styles.addBtnText}>+ Создать КП</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {!showForm && quotes.map(q => (
            <View key={q.id} style={styles.card}>
              <Text style={styles.cardTitle}>{q.quote_number}</Text>
              <Text style={styles.cardRow}>Статус: {q.status_label}</Text>
              <Text style={styles.cardRow}>Клиент: {q.customer_name}</Text>
              <Text style={styles.cardRow}>Подытог: {formatMoney(q.subtotal)} ₽</Text>
              {parseFloat(q.discount_amount) > 0 && <Text style={styles.cardRow}>Скидка: -{formatMoney(q.discount_amount)} ₽</Text>}
              {parseFloat(q.delivery_cost) > 0 && <Text style={styles.cardRow}>Доставка: +{formatMoney(q.delivery_cost)} ₽</Text>}
              {parseFloat(q.installation_cost) > 0 && <Text style={styles.cardRow}>Монтаж: +{formatMoney(q.installation_cost)} ₽</Text>}
              <Text style={styles.cardTotal}>Итого: {formatMoney(q.total)} ₽</Text>
              <Text style={styles.cardRow}>Предоплата ({Math.round(parseFloat(q.prepayment_percent) * 100)}%): {formatMoney(parseFloat(q.total) * parseFloat(q.prepayment_percent))} ₽</Text>

              {q.items.map((item, i) => (
                <View key={item.id ?? i} style={styles.itemRow}>
                  <Text style={styles.itemTitle}>{item.room_name}{item.window_name ? ` — ${item.window_name}` : ''}</Text>
                  <Text style={styles.itemDetail}>{item.window_width_cm}×{item.window_height_cm} см</Text>
                  {parseFloat(item.fabric_cost) > 0 && <Text style={styles.itemDetail}>Ткань: {formatMoney(item.fabric_cost)} ₽</Text>}
                  {parseFloat(item.tulle_cost) > 0 && <Text style={styles.itemDetail}>Тюль: {formatMoney(item.tulle_cost)} ₽</Text>}
                  {parseFloat(item.sewing_cost) > 0 && <Text style={styles.itemDetail}>Пошив: {formatMoney(item.sewing_cost)} ₽</Text>}
                  {parseFloat(item.installation_price) > 0 && <Text style={styles.itemDetail}>Монтаж: {formatMoney(item.installation_price)} ₽</Text>}
                  <Text style={styles.itemTotal}>Позиция: {formatMoney(item.line_total)} ₽</Text>
                </View>
              ))}

              {canEdit && (
                <TouchableOpacity
                  style={[styles.pdfBtn, q.pdf_generated && styles.pdfBtnGenerated]}
                  onPress={() => handleGeneratePdf(q.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.pdfBtnText}>
                    {q.pdf_generated ? '📄 Перегенерировать PDF' : '📄 Сгенерировать PDF'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ))}

          {showForm && (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Новое КП</Text>

              {formItems.map((item, idx) => (
                <View key={idx} style={styles.itemFormCard}>
                  <Text style={styles.itemFormTitle}>{item.room_name}{item.window_name ? ` — ${item.window_name}` : ''}</Text>
                  <Text style={styles.itemFormSubtitle}>{item.window_width_cm}×{item.window_height_cm} см</Text>

                  <View style={styles.row}>
                    <View style={[styles.field, { flex: 1 }]}>
                      <Text style={styles.label}>Метраж ткани</Text>
                      <TextInput style={styles.input} value={item.fabric_meters} onChangeText={v => updateItem(idx, 'fabric_meters', v)} keyboardType="numeric" placeholder="м" />
                    </View>
                    <View style={[styles.field, { flex: 1, marginLeft: spacing.base }]}>
                      <Text style={styles.label}>Цена ткани</Text>
                      <TextInput style={styles.input} value={item.fabric_cost} onChangeText={v => updateItem(idx, 'fabric_cost', v)} keyboardType="numeric" placeholder="₽" />
                    </View>
                  </View>

                  <View style={styles.row}>
                    <View style={[styles.field, { flex: 1 }]}>
                      <Text style={styles.label}>Метраж тюли</Text>
                      <TextInput style={styles.input} value={item.tulle_meters} onChangeText={v => updateItem(idx, 'tulle_meters', v)} keyboardType="numeric" placeholder="м" />
                    </View>
                    <View style={[styles.field, { flex: 1, marginLeft: spacing.base }]}>
                      <Text style={styles.label}>Цена тюли</Text>
                      <TextInput style={styles.input} value={item.tulle_cost} onChangeText={v => updateItem(idx, 'tulle_cost', v)} keyboardType="numeric" placeholder="₽" />
                    </View>
                  </View>

                  <View style={styles.row}>
                    <View style={[styles.field, { flex: 1 }]}>
                      <Text style={styles.label}>Пошив</Text>
                      <TextInput style={styles.input} value={item.sewing_cost} onChangeText={v => updateItem(idx, 'sewing_cost', v)} keyboardType="numeric" placeholder="₽" />
                    </View>
                    <View style={[styles.field, { flex: 1, marginLeft: spacing.base }]}>
                      <Text style={styles.label}>Монтаж</Text>
                      <TextInput style={styles.input} value={item.installation_price} onChangeText={v => updateItem(idx, 'installation_price', v)} keyboardType="numeric" placeholder="₽" />
                    </View>
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>Аксессуары</Text>
                    <TextInput style={styles.input} value={item.accessories_cost} onChangeText={v => updateItem(idx, 'accessories_cost', v)} keyboardType="numeric" placeholder="₽" />
                  </View>

                  <Text style={styles.itemAutoTotal}>Итого позиции: {formatMoney(item.line_total)} ₽</Text>
                </View>
              ))}

              <View style={[styles.field, { marginTop: spacing.base }]}>
                <Text style={styles.label}>Срок действия (YYYY-MM-DD)</Text>
                <TextInput style={styles.input} value={validUntil} onChangeText={setValidUntil} placeholder="2026-12-31" />
              </View>

              <View style={styles.row}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>Скидка (₽)</Text>
                  <TextInput style={styles.input} value={discountAmount} onChangeText={setDiscountAmount} keyboardType="numeric" placeholder="0" />
                </View>
                <View style={[styles.field, { flex: 1, marginLeft: spacing.base }]}>
                  <Text style={styles.label}>Доставка (₽)</Text>
                  <TextInput style={styles.input} value={deliveryCost} onChangeText={setDeliveryCost} keyboardType="numeric" placeholder="0" />
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>Монтаж общий (₽)</Text>
                  <TextInput style={styles.input} value={installationCost} onChangeText={setInstallationCost} keyboardType="numeric" placeholder="0" />
                </View>
                <View style={[styles.field, { flex: 1, marginLeft: spacing.base }]}>
                  <Text style={styles.label}>Предоплата (%)</Text>
                  <TextInput style={styles.input} value={prepaymentPercent} onChangeText={setPrepaymentPercent} keyboardType="numeric" placeholder="50" />
                </View>
              </View>

              <View style={styles.grandTotalBox}>
                <Text style={styles.grandTotalLabel}>Итоговая сумма:</Text>
                <Text style={styles.grandTotalValue}>{formatMoney(calculateGrandTotal())} ₽</Text>
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
                    <Text style={styles.submitBtnText}>Сохранить КП</Text>
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
    gap: spacing.base,
  },
  emptyText: { fontSize: typography.sizes.base, color: colors.textMuted },
  addBtn: {
    backgroundColor: colors.primary[500],
    borderRadius: radius.lg,
    padding: spacing.base,
    alignItems: 'center',
    width: '100%',
  },
  addBtnText: { color: colors.white, fontSize: typography.sizes.base, fontWeight: '500' },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: spacing.base,
    gap: spacing.xs,
  },
  cardTitle: { fontSize: typography.sizes.lg, fontWeight: '500', color: colors.text },
  cardRow: { fontSize: typography.sizes.sm, color: colors.textMuted },
  cardTotal: { fontSize: typography.sizes.base, fontWeight: '600', color: colors.text, marginTop: spacing.xs },
  itemRow: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
    gap: 2,
  },
  itemTitle: { fontSize: typography.sizes.base, fontWeight: '500', color: colors.text },
  itemDetail: { fontSize: typography.sizes.sm, color: colors.textMuted },
  itemTotal: { fontSize: typography.sizes.sm, fontWeight: '500', color: colors.text, marginTop: 2 },
  pdfBtn: {
    backgroundColor: colors.primary[500],
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  pdfBtnGenerated: { backgroundColor: colors.success.DEFAULT },
  pdfBtnText: { color: colors.white, fontSize: typography.sizes.base, fontWeight: '500' },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: spacing.base,
    gap: spacing.base,
  },
  formTitle: { fontSize: typography.sizes.lg, fontWeight: '500', color: colors.text },
  itemFormCard: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.base,
    gap: spacing.sm,
  },
  itemFormTitle: { fontSize: typography.sizes.base, fontWeight: '500', color: colors.text },
  itemFormSubtitle: { fontSize: typography.sizes.sm, color: colors.textMuted },
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
  row: { flexDirection: 'row' },
  itemAutoTotal: { fontSize: typography.sizes.sm, fontWeight: '600', color: colors.text, marginTop: spacing.xs },
  grandTotalBox: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.md,
    padding: spacing.base,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  grandTotalLabel: { fontSize: typography.sizes.base, fontWeight: '500', color: colors.text },
  grandTotalValue: { fontSize: typography.sizes.lg, fontWeight: '600', color: colors.primary[500] },
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

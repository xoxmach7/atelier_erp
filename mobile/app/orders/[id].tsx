import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
  StyleSheet, Platform, StatusBar, Modal, TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthContext } from '../../src/context/AuthContext';
import {
  fetchOrderExecution, fetchQuotes, deleteOrder, deleteMeasurement, updateMeasurement,
  changeOrderStatus,
  type OrderExecution, type QuoteDTO,
} from '../../src/api/orders';
import { recordPayment } from '../../src/api/payments';
import { IconButton, Icon } from '../../src/components/Icon';

function fmtDate(d?: string | null): string {
  if (!d) return '—';
  const p = d.split('T')[0].split('-');
  if (p.length !== 3) return d;
  return `${p[2]}.${p[1]}.${p[0]}`;
}

function fmtMoney(v: string | number | null | undefined): string {
  const n = typeof v === 'string' ? parseFloat(v) : (v ?? 0);
  if (!n || isNaN(n)) return '0';
  return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
}

const ADDRESS_PLACEHOLDER = 'город, улица, дом, квартира, примечание';

function addressText(data: OrderExecution): string {
  // Адрес заказа отдаётся сервером на верхнем уровне (installation_address);
  // customer.address — это адрес клиента, который мобилка не заполняет.
  if (data.installation_address) return data.installation_address;
  const a = data.customer?.address;
  if (!a) return ADDRESS_PLACEHOLDER;
  if (typeof a === 'string') return a || ADDRESS_PLACEHOLDER;
  return [a.city, a.street, a.building, a.apartment].filter(Boolean).join(', ') || ADDRESS_PLACEHOLDER;
}

export default function OrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const idStr = String(id);
  const insets = useSafeAreaInsets();
  const { primaryRole } = useAuthContext();
  const [data, setData] = useState<OrderExecution | null>(null);
  const [quote, setQuote] = useState<QuoteDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Модалка предоплаты (кнопка ₸)
  const [showPrepay, setShowPrepay] = useState(false);
  const [deposit, setDeposit] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  // Модалка одного замера (тап по строке)
  type MeasurementRow = NonNullable<OrderExecution['measurements']>[number];
  const [selected, setSelected] = useState<MeasurementRow | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError(null);
    try {
      const exec = await fetchOrderExecution(idStr);
      setData(exec);
      try {
        const q = await fetchQuotes(idStr);
        setQuote(q.results?.[0] ?? null);
      } catch { setQuote(null); }
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось загрузить заказ');
    } finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onDelete = () => {
    Alert.alert('Удалить заказ?', `Заказ ${data?.order_number ?? ''}`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить', style: 'destructive',
        onPress: async () => {
          try { await deleteOrder(idStr); router.back(); }
          catch (e: any) { Alert.alert('Ошибка', e?.message ?? 'Не удалось удалить'); }
        },
      },
    ]);
  };

  // ₸ — предоплата по заказу. Размер берём из КП (итог × процент предоплаты).
  const prepayAmount = quote
    ? Math.round((parseFloat(quote.total) || 0) * (parseFloat(quote.prepayment_percent) || 0.5))
    : 0;

  const openPrepay = () => {
    if (!quote) {
      Alert.alert('Нет КП', 'Сначала создайте КП — от него считается предоплата');
      return;
    }
    setDeposit('');
    setShowPrepay(true);
  };

  const savePrepay = async () => {
    const amount = parseFloat(deposit);
    if (!amount || amount <= 0) { Alert.alert('Ошибка', 'Введите сумму больше нуля'); return; }
    setSavingPayment(true);
    try {
      await recordPayment({ orderId: idStr, amount, type: 'prepayment', method: 'cash' });
      setShowPrepay(false);
      await load();
      Alert.alert('Готово', 'Предоплата внесена');
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось сохранить платёж');
    } finally { setSavingPayment(false); }
  };

  // Галочка по окну: у склада — сборка материалов, у швеи — пошив.
  // Поле выбирается по роли, бэкенд дополнительно режет набор полей
  // (MeasurementWarehouseFlagSerializer / MeasurementSewingFlagSerializer).
  const toggleWindowFlag = async (m: MeasurementRow) => {
    const patch = primaryRole === 'production'
      ? { sewing_done: !m.sewing_done }
      : { materials_ready: !m.materials_ready };
    try {
      await updateMeasurement(String(m.id), patch);
      await load();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось обновить отметку');
    }
  };

  // Смена статуса заказа. Что именно разрешено — решает бэк (FSM в
  // constants.OrderFSMRules) и отдаёт во флагах data.actions; мобилка только
  // рисует доступные шаги, своей копии правил перехода не держит.
  const nextSteps = (): Array<{ label: string; status: string }> => {
    const a = data?.actions ?? {};
    const steps: Array<{ label: string; status: string }> = [];
    if (a.can_take_in_work) steps.push({ label: 'Взять в работу', status: 'in_work' });
    if (a.can_start_production) steps.push({ label: 'Передать в производство', status: 'in_production' });
    if (a.can_mark_ready) steps.push({ label: 'Отметить готовым', status: 'ready' });
    if (a.can_start_installation) steps.push({ label: 'На установку / выдачу', status: 'on_installation' });
    if (a.can_complete) steps.push({ label: 'Завершить заказ', status: 'completed' });
    return steps;
  };

  const applyStatus = async (label: string, status: string) => {
    setChangingStatus(true);
    try {
      await changeOrderStatus(idStr, status);
      await load();
      Alert.alert('Готово', `Статус изменён: ${label}`);
    } catch (e: any) {
      // Бэк объясняет отказ по-человечески («Сначала примите КП…») — показываем как есть.
      Alert.alert('Не удалось сменить статус', e?.message ?? 'Переход запрещён');
    } finally { setChangingStatus(false); }
  };

  const openStatusMenu = () => {
    const steps = nextSteps();
    const canCancel = data?.actions?.can_cancel;
    if (steps.length === 0 && !canCancel) {
      Alert.alert('Нет доступных переходов', `Текущий статус: ${data?.status_label ?? '—'}`);
      return;
    }
    Alert.alert(
      'Сменить статус',
      `Сейчас: ${data?.status_label ?? '—'}`,
      [
        ...steps.map(st => ({ text: st.label, onPress: () => applyStatus(st.label, st.status) })),
        ...(canCancel
          ? [{
              text: 'Отменить заказ',
              style: 'destructive' as const,
              onPress: () => applyStatus('Заказ отменён', 'cancelled'),
            }]
          : []),
        { text: 'Закрыть', style: 'cancel' as const },
      ]
    );
  };

  const openMeasurementMenu = (m: MeasurementRow) => {
    Alert.alert(m.room_name, m.window_name ?? '', [
      {
        text: 'Редактировать',
        onPress: () => router.push(`/orders/measurement-edit?id=${m.id}&orderId=${idStr}`),
      },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Удалить замер?', `${m.room_name} — ${m.window_name ?? ''}`, [
            { text: 'Отмена', style: 'cancel' },
            {
              text: 'Удалить', style: 'destructive',
              onPress: async () => {
                try { setSelected(null); await deleteMeasurement(String(m.id)); await load(); }
                catch (e: any) { Alert.alert('Ошибка', e?.message ?? 'Не удалось удалить замер'); }
              },
            },
          ]);
        },
      },
      { text: 'Отмена', style: 'cancel' },
    ]);
  };

  if (loading) return <View style={s.centered}><ActivityIndicator color="#60CCED" size="large" /></View>;
  if (error || !data) {
    return (
      <View style={s.centered}>
        <Text style={s.errorText}>{error ?? 'Заказ не найден'}</Text>
        <TouchableOpacity onPress={load} style={s.retryBtn}><Text style={s.retryText}>Повторить</Text></TouchableOpacity>
      </View>
    );
  }

  const num = data.order_number?.match(/\d+$/)?.[0] ?? data.order_number;
  const measurements = data.measurements ?? [];
  // Склад вместо цены отмечает готовность материалов по каждому окну.
  const isWarehouse = primaryRole === 'warehouse';
  // 'production' — швейный цех (группа Seamstress, см. groupsToRole).
  // Швея отмечает по окну, что изделие сшито.
  const isSeamstress = primaryRole === 'production';
  // Обе роли работают по чужому заказу: ни править сам заказ и замеры, ни
  // создавать КП или принимать оплату им не положено (бэкенд это и не пустит).
  const isExecutor = isWarehouse || isSeamstress;

  /** Отмечено ли окно текущей ролью: склад смотрит на сборку, швея — на пошив. */
  const windowDone = (m: MeasurementRow): boolean =>
    Boolean(isSeamstress ? m.sewing_done : m.materials_ready);

  // price per window from quote items (match by room+window)
  const priceFor = (room?: string, window?: string): string | null => {
    const it = quote?.items?.find(q => q.room_name === room && q.window_name === window);
    return it ? it.line_total : null;
  };

  return (
    <View style={s.screen}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.6}>
          <Text style={s.back}>Назад</Text>
        </TouchableOpacity>
        <Text style={s.title}>Заказ №{num}</Text>

        {!isExecutor && (
          <View style={s.actionsRow}>
            <IconButton name="edit" size={40} onPress={() => router.push(`/orders/${idStr}/edit`)} />
            <IconButton name="trash" size={40} onPress={onDelete} />
          </View>
        )}

        {/* Карточка заказа */}
        <View style={s.addrCard}>
          <Text style={s.addrLine}><Text style={s.addrLabel}>Клиент: </Text>{data.customer?.full_name || '—'}</Text>
          <Text style={[s.addrLine, s.addrGap]}><Text style={s.addrLabel}>Создан: </Text>{fmtDate(data.created_at)}</Text>
          <Text style={[s.addrLine, s.addrGap]}><Text style={s.addrLabel}>Дизайнер: </Text>{data.designer_name || '—'}</Text>
          {/* Статус — кликабельный: тап открывает список разрешённых переходов.
              Смену статуса бэкенд разрешает только владельцу и дизайнеру
              (IsOwnerOrDesigner на change-status), поэтому у исполнителей это
              просто строка, без ложной кнопки. */}
          <TouchableOpacity
            style={[s.addrGap, s.statusRow]}
            onPress={openStatusMenu}
            activeOpacity={0.6}
            disabled={changingStatus || isExecutor}
          >
            <Text style={s.addrLine}>
              <Text style={s.addrLabel}>Статус: </Text>{data.status_label || '—'}
            </Text>
            {changingStatus && <ActivityIndicator size="small" color="#60CCED" />}
            {!changingStatus && !isExecutor && <Text style={s.statusChange}>изменить</Text>}
          </TouchableOpacity>
          <Text style={[s.addrLine, s.addrGap]}><Text style={s.addrLabel}>Завершение: </Text>{fmtDate(data.planned_completion)}</Text>
          <Text style={[s.addrLine, s.addrGap]}><Text style={s.addrLabel}>Дата замера: </Text>{fmtDate(data.measurement_date)}</Text>
          <Text style={[s.addrLine, s.addrGap]}><Text style={s.addrLabel}>Адрес: </Text>{addressText(data)}</Text>
        </View>

        {/* Measurements section */}
        <Text style={s.sectionTitle}>Замеры</Text>
        {/* КП, добавление замера и предоплата — не для склада и швеи:
            они работают по готовому заказу, а бэкенд эти действия им и не даст. */}
        {!isExecutor && (
          <View style={s.toolRow}>
            <TouchableOpacity style={s.kpBtn} onPress={() => router.push(`/orders/${idStr}/quote`)} activeOpacity={0.85}>
              <Icon name="doc" size={18} color="#fff" />
              <Text style={s.kpBtnText}>Создать КП</Text>
            </TouchableOpacity>
            <View style={s.toolIcons}>
              <IconButton name="plus" size={38} onPress={() => router.push(`/orders/measurement-new?orderId=${idStr}`)} />
              <IconButton name="tenge" size={38} onPress={openPrepay} />
              <IconButton name="search" size={38} onPress={() => {}} />
            </View>
          </View>
        )}

        {measurements.length === 0 ? (
          <Text style={s.empty}>Замеры ещё не добавлены</Text>
        ) : (
          measurements.map((m) => {
            const dims = m.width_cm && m.height_cm ? ` (${m.width_cm}x${m.height_cm})` : '';
            const price = priceFor(m.room_name, m.window_name);
            return (
              // ⋮ — отдельный Touchable рядом со строкой, НЕ внутри неё:
              // вложенные Touchable в RN конфликтуют, нажатие перехватывает внешний.
              <View key={m.id} style={s.mRow}>
                <TouchableOpacity
                  style={s.mRowMain}
                  activeOpacity={0.6}
                  onPress={() => setSelected(m)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.mRoom}>{m.room_name}</Text>
                    <Text style={s.mWindow}>{m.window_name}{dims}</Text>
                  </View>
                  {!isWarehouse && price != null && <Text style={s.mPrice}>{fmtMoney(price)} ₸</Text>}
                </TouchableOpacity>
                {isExecutor && (
                  <TouchableOpacity
                    style={[s.checkBox, windowDone(m) && s.checkBoxOn]}
                    onPress={() => toggleWindowFlag(m)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Icon name="check" size={20} color={windowDone(m) ? '#FFFFFF' : '#CBD5E1'} />
                  </TouchableOpacity>
                )}
                {!isExecutor && (
                <TouchableOpacity
                  style={s.mMenu}
                  onPress={() => openMeasurementMenu(m)}
                  activeOpacity={0.6}
                  hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                >
                  <Icon name="dots" size={20} color="#94A3B8" />
                </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Модалка предоплаты (кнопка ₸) */}
      <Modal visible={showPrepay} transparent animationType="fade" onRequestClose={() => setShowPrepay(false)}>
        <TouchableOpacity style={s.modalBg} activeOpacity={1} onPress={() => setShowPrepay(false)}>
          <TouchableOpacity style={s.modalCard} activeOpacity={1}>
            <Text style={s.modalTitle}>Заказ №{num}</Text>

            <View style={s.prepayRow}>
              <Text style={s.prepayLabel}>Размер предоплаты:</Text>
              <Text style={s.prepayAmount}>{fmtMoney(prepayAmount)} ₸</Text>
            </View>

            <View style={s.prepayRow}>
              <Text style={s.prepayLabel}>Внесено:</Text>
              <TextInput
                style={s.depositInput}
                value={deposit}
                onChangeText={setDeposit}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#94A3B8"
              />
              <Text style={s.prepayUnit}>₸</Text>
            </View>

            <TouchableOpacity
              style={[s.modalBtn, savingPayment && s.modalBtnDisabled]}
              onPress={savePrepay}
              disabled={savingPayment}
              activeOpacity={0.85}
            >
              {savingPayment
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.modalBtnText}>Сохранить</Text>}
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Модалка одного замера (тап по строке) */}
      <Modal visible={selected !== null} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <TouchableOpacity style={s.modalBg} activeOpacity={1} onPress={() => setSelected(null)}>
          <TouchableOpacity style={s.modalCard} activeOpacity={1}>
            {selected && (
              <>
                <Text style={s.mdRoom}>{selected.room_name}</Text>
                <Text style={s.mdLine}>
                  {selected.window_name}
                  {selected.width_cm && selected.height_cm ? ` (${selected.width_cm}x${selected.height_cm})` : ''}
                </Text>
                {Boolean(selected.curtain_fabric_name) && (
                  <Text style={s.mdLine}>
                    <Text style={s.mdLabel}>Шторы: </Text>{selected.curtain_fabric_name}
                    {selected.curtain_meters ? ` (${selected.curtain_meters} м)` : ''}
                  </Text>
                )}
                {Boolean(selected.tulle_fabric_name) && (
                  <Text style={s.mdLine}>
                    <Text style={s.mdLabel}>Тюль: </Text>{selected.tulle_fabric_name}
                    {selected.tulle_meters ? ` (${selected.tulle_meters} м)` : ''}
                  </Text>
                )}
                <Text style={s.mdLine}><Text style={s.mdLabel}>Тип крепления: </Text>{selected.mounting_type || '—'}</Text>
                <Text style={s.mdLine}><Text style={s.mdLabel}>Комментарий: </Text>{selected.notes || '—'}</Text>
                {/* Обозначение единицы: одно окно — одно изделие. Отдельного
                    поля количества у замера нет и не планируется. */}
                <Text style={[s.mdLine, { marginTop: 10 }]}><Text style={s.mdLabel}>Количество: </Text>1</Text>

                {priceFor(selected.room_name, selected.window_name) != null && (
                  <Text style={[s.mdLine, { marginTop: 10 }]}>
                    <Text style={s.mdLabel}>Стоимость: </Text>
                    {fmtMoney(priceFor(selected.room_name, selected.window_name))} ₸
                  </Text>
                )}

                <View style={s.mdActions}>
                  <TouchableOpacity
                    style={[s.mdBtn, s.mdBtnGhost]}
                    onPress={() => { const m = selected; setSelected(null); if (m) openMeasurementMenu(m); }}
                    activeOpacity={0.8}
                  >
                    <Text style={s.mdBtnGhostText}>Изменить</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.mdBtn} onPress={() => setSelected(null)} activeOpacity={0.85}>
                    <Text style={s.modalBtnText}>Закрыть</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', padding: 16 },
  errorText: { fontSize: 14, color: '#EF4444', textAlign: 'center', marginBottom: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#F4F4F4', borderRadius: 8 },
  retryText: { fontSize: 14, color: '#0F172A', fontFamily: 'TTNormsPro-Medium' },

  content: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 16 : 20,
    paddingBottom: 32,
  },
  back: { fontSize: 16, color: '#94A3B8', fontFamily: 'TTNormsPro-Regular', marginBottom: 10 },
  title: { fontSize: 28, fontFamily: 'TTNormsPro-Bold', color: '#0F172A', textAlign: 'center' },
  actionsRow: { flexDirection: 'row', gap: 16, justifyContent: 'flex-end', marginTop: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusChange: { fontSize: 13, color: '#60CCED', fontWeight: '600' },

  addrCard: { backgroundColor: '#F1F3F5', borderRadius: 16, padding: 20, marginTop: 18 },
  addrLine: { fontSize: 17, color: '#0F172A', fontFamily: 'TTNormsPro-Regular', lineHeight: 24 },
  addrGap: { marginTop: 14 },
  addrLabel: { fontFamily: 'TTNormsPro-Bold' },

  sectionTitle: { fontSize: 28, fontFamily: 'TTNormsPro-Bold', color: '#0F172A', marginTop: 26 },
  toolRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 8 },
  kpBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#60CCED', borderRadius: 10, paddingHorizontal: 16, height: 40 },
  kpBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'TTNormsPro-Regular' },
  toolIcons: { flexDirection: 'row', gap: 12 },

  empty: { fontSize: 15, color: '#94A3B8', fontFamily: 'TTNormsPro-Regular', textAlign: 'center', marginTop: 24 },
  mRow: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#EEF1F4',
  },
  mRowMain: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 16,
  },
  mRoom: { fontSize: 17, color: '#0F172A', fontFamily: 'TTNormsPro-Regular' },
  mWindow: { fontSize: 16, color: '#475569', fontFamily: 'TTNormsPro-Regular', marginTop: 2 },
  mPrice: { fontSize: 18, color: '#0F172A', fontFamily: 'TTNormsPro-Bold' },
  mMenu: { width: 40, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  checkBox: {
    width: 38, height: 38, borderRadius: 10, marginLeft: 8,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F3F5',
  },
  checkBoxOn: { backgroundColor: '#22C55E' },

  // ─── Модалки ───────────────────────────────────────────────────────────────
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24 },
  modalTitle: { fontSize: 22, fontFamily: 'TTNormsPro-Bold', color: '#0F172A', textAlign: 'center', marginBottom: 22 },

  prepayRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  prepayLabel: { fontSize: 17, color: '#0F172A', fontFamily: 'TTNormsPro-Regular', flex: 1 },
  prepayAmount: { fontSize: 18, color: '#0F172A', fontFamily: 'TTNormsPro-Bold' },
  depositInput: {
    width: 110, backgroundColor: '#E9E9E9', borderRadius: 10, height: 44,
    paddingHorizontal: 14, fontSize: 17, color: '#0F172A', fontFamily: 'TTNormsPro-Regular',
  },
  prepayUnit: { fontSize: 18, color: '#0F172A', fontFamily: 'TTNormsPro-Regular', marginLeft: 10 },

  modalBtn: {
    backgroundColor: '#60CCED', borderRadius: 12, height: 52,
    alignItems: 'center', justifyContent: 'center', marginTop: 8, flex: 1,
  },
  modalBtnDisabled: { opacity: 0.5 },
  modalBtnText: { color: '#FFFFFF', fontSize: 17, fontFamily: 'TTNormsPro-Regular' },

  mdRoom: { fontSize: 20, color: '#0F172A', fontFamily: 'TTNormsPro-Bold', marginBottom: 6 },
  mdLine: { fontSize: 16, color: '#0F172A', fontFamily: 'TTNormsPro-Regular', lineHeight: 24 },
  mdLabel: { fontFamily: 'TTNormsPro-Bold' },
  mdActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  mdBtn: {
    backgroundColor: '#60CCED', borderRadius: 12, height: 48,
    alignItems: 'center', justifyContent: 'center', flex: 1,
  },
  mdBtnGhost: { backgroundColor: '#F1F3F5' },
  mdBtnGhostText: { color: '#0F172A', fontSize: 16, fontFamily: 'TTNormsPro-Regular' },
});

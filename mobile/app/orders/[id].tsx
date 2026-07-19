import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
  StyleSheet, Platform, StatusBar, Modal, TextInput, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthContext } from '../../src/context/AuthContext';
import {
  fetchOrderExecution, fetchQuotes, deleteOrder, deleteMeasurement, updateMeasurement,
  changeOrderStatus, uploadPhotoReport, deletePhotoReport,
  fetchCompletionAct, createCompletionAct, uploadSignedAct,
  changeProductionStage, changeHandoverStage,
  type OrderExecution, type QuoteDTO,
} from '../../src/api/orders';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
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

/** Имя файла из URL — в карточке АВР показываем «avr.pdf», а не весь путь. */
function fileNameOf(url: string): string {
  const clean = url.split('?')[0];
  return decodeURIComponent(clean.substring(clean.lastIndexOf('/') + 1)) || 'файл';
}

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

  // Установщик: имя загруженного файла АВР и индикаторы занятости.
  const [actFile, setActFile] = useState<string | null>(null);
  const [uploadingAct, setUploadingAct] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  // Цех/установщик: галочки по окнам (sewing_done/installation_done) не
  // двигают заказ сами по себе — это отдельные поля Measurement, а переход
  // читает production_stage/handover_stage на Order. Без явного завершения
  // этапа заказ навсегда застревал бы в in_production/on_installation, даже
  // если все окна отмечены. changeProductionStage/changeHandoverStage раньше
  // существовали только в api-слое и нигде не вызывались.
  const [finishingStage, setFinishingStage] = useState(false);

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

  // Имя загруженного АВР для карточки установщика. Объявлено до useFocusEffect,
  // который его дёргает.
  const loadAct = useCallback(async () => {
    if (primaryRole !== 'installation') return;
    try {
      const res = await fetchCompletionAct(idStr);
      setActFile(res?.act?.signed_file_url ? fileNameOf(res.act.signed_file_url) : null);
    } catch { setActFile(null); }
  }, [idStr, primaryRole]);

  useFocusEffect(useCallback(() => { load(); loadAct(); }, [load, loadAct]));

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
    let patch: Record<string, boolean>;
    if (primaryRole === 'production') patch = { sewing_done: !m.sewing_done };
    else if (primaryRole === 'installation') patch = { installation_done: !m.installation_done };
    else patch = { materials_ready: !m.materials_ready };
    try {
      await updateMeasurement(String(m.id), patch);
      await load();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось обновить отметку');
    }
  };

  // Цех: все изделия сшиты — завершить производство, заказ откроется
  // установщику (auto_advance переведёт в ready на бэке).
  const finishProduction = async () => {
    setFinishingStage(true);
    try {
      await changeProductionStage(idStr, 'done');
      await load();
      Alert.alert('Готово', 'Производство завершено');
    } catch (e: any) {
      Alert.alert('Не удалось завершить', e?.message ?? 'Попробуйте ещё раз');
    } finally { setFinishingStage(false); }
  };

  // Установщик: все изделия навешены — завершить установку/выдачу.
  const finishHandover = async () => {
    setFinishingStage(true);
    try {
      await changeHandoverStage(idStr, 'done');
      await load();
      Alert.alert('Готово', 'Установка завершена');
    } catch (e: any) {
      Alert.alert('Не удалось завершить', e?.message ?? 'Попробуйте ещё раз');
    } finally { setFinishingStage(false); }
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

  // ── Установщик: АВР и фотоотчёт по окну ────────────────────────────────

  const onUploadAct = async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.length) return;
    const file = picked.assets[0];

    setUploadingAct(true);
    try {
      // АВР создаётся отдельной ручкой и только после установки/выдачи;
      // если он уже есть, бэкенд вернёт существующий, а не ошибку.
      try { await createCompletionAct(idStr); } catch { /* уже создан либо ещё рано */ }

      const form = new FormData();
      form.append('signed_file', {
        uri: file.uri,
        name: file.name ?? 'avr.pdf',
        type: file.mimeType ?? 'application/pdf',
      } as any);
      await uploadSignedAct(idStr, form);
      await loadAct();
      Alert.alert('Готово', 'АВР загружен');
    } catch (e: any) {
      Alert.alert('Не удалось загрузить АВР', e?.message ?? 'Попробуйте ещё раз');
    } finally { setUploadingAct(false); }
  };

  const onAddPhoto = async (m: MeasurementRow) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Нет доступа', 'Разрешите доступ к фото в настройках');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (picked.canceled || !picked.assets?.length) return;
    const asset = picked.assets[0];

    setPhotoBusy(true);
    try {
      const form = new FormData();
      form.append('file', {
        uri: asset.uri,
        name: asset.fileName ?? 'photo.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      } as any);
      form.append('measurement', String(m.id));
      await uploadPhotoReport(idStr, form);
      const fresh = await reloadSelected(m);
      if (fresh) setSelected(fresh);
    } catch (e: any) {
      Alert.alert('Не удалось прикрепить фото', e?.message ?? 'Попробуйте ещё раз');
    } finally { setPhotoBusy(false); }
  };

  const onDeletePhoto = (m: MeasurementRow, photoId: string) => {
    Alert.alert('Удалить фото?', '', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить', style: 'destructive',
        onPress: async () => {
          setPhotoBusy(true);
          try {
            await deletePhotoReport(idStr, photoId);
            const fresh = await reloadSelected(m);
            if (fresh) setSelected(fresh);
          } catch (e: any) {
            Alert.alert('Ошибка', e?.message ?? 'Не удалось удалить фото');
          } finally { setPhotoBusy(false); }
        },
      },
    ]);
  };

  /** Перезагрузить заказ и вернуть то же окно с обновлёнными фото. */
  const reloadSelected = async (m: MeasurementRow): Promise<MeasurementRow | null> => {
    const exec = await fetchOrderExecution(idStr);
    setData(exec);
    return (exec.measurements ?? []).find(x => String(x.id) === String(m.id)) ?? null;
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
  const isInstaller = primaryRole === 'installation';
  // Исполнители работают по чужому заказу: ни править сам заказ и замеры, ни
  // создавать КП или принимать оплату им не положено (бэкенд это и не пустит).
  const isExecutor = isWarehouse || isSeamstress || isInstaller;

  /**
   * Отмечено ли окно текущей ролью. Три независимых флага по одной цепочке:
   * склад собрал материалы → цех сшил → монтаж повесил.
   */
  const windowDone = (m: MeasurementRow): boolean => {
    if (isSeamstress) return Boolean(m.sewing_done);
    if (isInstaller) return Boolean(m.installation_done);
    return Boolean(m.materials_ready);
  };

  const allWindowsDone = measurements.length > 0 && measurements.every(windowDone);
  const productionDone = data.production_stage === 'done';
  const handoverDone = data.handover_stage === 'done';

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

        {/* Карточка установщика: в поле нужны только адрес и срок. */}
        {isInstaller ? (
          <View style={s.addrCard}>
            <Text style={s.addrLine}><Text style={s.addrLabel}>Адрес: </Text>{addressText(data)}</Text>
            <Text style={[s.addrLine, { marginTop: 14 }]}>
              <Text style={s.addrLabel}>Завершение: </Text>{fmtDate(data.planned_completion)}
            </Text>
          </View>
        ) : (
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
              {/* Показываем группу, а не сырой статус FSM: иначе список
                  говорит «Просрочен», а карточка — «Ожидает финальной оплаты». */}
              <Text style={s.addrLabel}>Статус: </Text>
              {data.status_group_label || data.status_label || '—'}
            </Text>
            {changingStatus && <ActivityIndicator size="small" color="#60CCED" />}
            {!changingStatus && !isExecutor && <Text style={s.statusChange}>изменить</Text>}
          </TouchableOpacity>
          <Text style={[s.addrLine, s.addrGap]}><Text style={s.addrLabel}>Завершение: </Text>{fmtDate(data.planned_completion)}</Text>
          <Text style={[s.addrLine, s.addrGap]}><Text style={s.addrLabel}>Дата замера: </Text>{fmtDate(data.measurement_date)}</Text>
          <Text style={[s.addrLine, s.addrGap]}><Text style={s.addrLabel}>Адрес: </Text>{addressText(data)}</Text>
        </View>
        )}

        {/* Measurements section. У установщика это «Изделия»: он видит не
            замеры как таковые, а то, что нужно повесить. */}
        <Text style={s.sectionTitle}>{isInstaller ? 'Изделия' : 'Замеры'}</Text>

        {isInstaller && (
          <View style={s.actBlock}>
            <TouchableOpacity
              style={[s.actBtn, uploadingAct && s.actBtnDisabled]}
              onPress={onUploadAct}
              disabled={uploadingAct}
              activeOpacity={0.85}
            >
              {uploadingAct
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Icon name="doc" size={18} color="#fff" />
                    <Text style={s.actBtnText}>Загрузить АВР</Text>
                  </>}
            </TouchableOpacity>
            <Text style={s.actFile}>
              <Text style={s.addrLabel}>Файл: </Text>
              <Text style={s.actFileName}>{actFile ?? 'не загружен'}</Text>
            </Text>
          </View>
        )}
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

        {/* Завершение этапа — отдельное действие от галочек по окнам:
            production_stage/handover_stage живут на Order, а не на
            Measurement, и без явного нажатия заказ не поедет дальше по
            ролям, даже если все окна отмечены. */}
        {isSeamstress && measurements.length > 0 && (
          productionDone ? (
            <View style={s.finishDoneBanner}>
              <Icon name="check" size={16} color="#16A34A" />
              <Text style={s.finishDoneText}>Производство завершено</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[s.finishBtn, (!allWindowsDone || finishingStage) && s.finishBtnDisabled]}
              onPress={finishProduction}
              disabled={!allWindowsDone || finishingStage}
              activeOpacity={0.85}
            >
              {finishingStage
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.finishBtnText}>
                    Завершить пошив ({measurements.filter(windowDone).length}/{measurements.length})
                  </Text>}
            </TouchableOpacity>
          )
        )}
        {isInstaller && measurements.length > 0 && (
          handoverDone ? (
            <View style={s.finishDoneBanner}>
              <Icon name="check" size={16} color="#16A34A" />
              <Text style={s.finishDoneText}>Установка завершена</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[s.finishBtn, (!allWindowsDone || finishingStage) && s.finishBtnDisabled]}
              onPress={finishHandover}
              disabled={!allWindowsDone || finishingStage}
              activeOpacity={0.85}
            >
              {finishingStage
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.finishBtnText}>
                    Завершить установку ({measurements.filter(windowDone).length}/{measurements.length})
                  </Text>}
            </TouchableOpacity>
          )
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

                {/* Фотоотчёт по окну — экран установщика. */}
                {isInstaller && (
                  <View style={s.photoBlock}>
                    <View style={s.photoHead}>
                      <Text style={s.mdLabel}>Прикреплённые фото:</Text>
                      <IconButton name="plus" size={34} onPress={() => onAddPhoto(selected)} disabled={photoBusy} />
                    </View>
                    {(selected.photos ?? []).length === 0 ? (
                      <Text style={s.empty}>Фото пока нет</Text>
                    ) : (
                      (selected.photos ?? []).map(p => (
                        <View key={p.id} style={s.photoRow}>
                          {p.url
                            ? <Image source={{ uri: p.url }} style={s.photo} resizeMode="cover" />
                            : <View style={[s.photo, s.photoMissing]} />}
                          <IconButton
                            name="trash"
                            size={34}
                            bg="#60CCED"
                            onPress={() => onDeletePhoto(selected, p.id)}
                            disabled={photoBusy}
                          />
                        </View>
                      ))
                    )}
                  </View>
                )}

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

  // Установщик: блок АВР
  actBlock: { marginTop: 12, marginBottom: 6 },
  actBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#5B9BF8', borderRadius: 22, paddingVertical: 12,
    paddingHorizontal: 22, alignSelf: 'flex-start', minWidth: 210,
  },
  actBtnDisabled: { opacity: 0.6 },
  actBtnText: { color: '#FFFFFF', fontSize: 17, fontFamily: 'TTNormsPro-Bold' },
  actFile: { fontSize: 17, color: '#0F172A', marginTop: 14 },
  actFileName: { color: '#94A3B8' },

  // Цех/установщик: завершить этап целиком
  finishBtn: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#60CCED', borderRadius: 14, paddingVertical: 14,
    marginTop: 16,
  },
  finishBtnDisabled: { opacity: 0.5 },
  finishBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'TTNormsPro-Bold' },
  finishDoneBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#DCFCE7', borderRadius: 14, paddingVertical: 14, marginTop: 16,
  },
  finishDoneText: { color: '#16A34A', fontSize: 15, fontFamily: 'TTNormsPro-Bold' },

  // Установщик: фото по окну
  photoBlock: { marginTop: 18 },
  photoHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  photoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 12 },
  photo: { flex: 1, height: 180, borderRadius: 8, backgroundColor: '#EEF1F4' },
  photoMissing: { borderWidth: 1, borderColor: '#E2E8F0' },

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

  // Без flex: 1. Кнопка лежит в колонке, которая тянется по содержимому:
  // flex-ребёнок в такой колонке схлопывается в нулевую высоту (базис 0, а
  // распределять нечего), и «Сохранить» в модалке предоплаты был невидим —
  // высота 52 при этом перебивалась флексом.
  modalBtn: {
    backgroundColor: '#60CCED', borderRadius: 12, height: 52,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
    alignSelf: 'stretch',
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

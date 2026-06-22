import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Platform, StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Icon } from '../../../src/components/Icon';
import {
  fetchMeasurements, createQuote, fetchOrderExecution,
  type MeasurementsList, type CreateQuotePayload,
} from '../../../src/api/orders';
import { fetchFabricsList } from '../../../src/api/fabrics';

type Meas = MeasurementsList['results'][number];

interface Line {
  m: Meas;
  qty: number;
  price: string;
}

function money(n: number): string {
  return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
}

export default function QuoteScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const idStr = String(id);

  const [orderNum, setOrderNum] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [fabricNames, setFabricNames] = useState<Record<string, string>>({});
  const [deposit, setDeposit] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [meas, fabrics, exec] = await Promise.all([
          fetchMeasurements(idStr),
          fetchFabricsList().catch(() => []),
          fetchOrderExecution(idStr).catch(() => null),
        ]);
        setLines(meas.results.map(m => ({ m, qty: 1, price: '' })));
        const map: Record<string, string> = {};
        fabrics.forEach(f => { map[f.id] = f.name; });
        setFabricNames(map);
        if (exec) setOrderNum(exec.order_number?.match(/\d+$/)?.[0] ?? exec.order_number ?? '');
      } catch (e: any) {
        setError(e?.message ?? 'Не удалось загрузить замеры');
      } finally { setLoading(false); }
    })();
  }, [idStr]);

  const total = useMemo(
    () => lines.reduce((sum, l) => sum + (parseFloat(l.price) || 0) * l.qty, 0),
    [lines],
  );

  const prepayAmount = Math.round(total * 0.5);

  const setQty = (i: number, delta: number) =>
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, qty: Math.max(1, l.qty + delta) } : l));
  const setPrice = (i: number, v: string) =>
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, price: v } : l));

  const fabricLabel = (uuid?: string | null) => (uuid && fabricNames[uuid]) || (uuid ? '—' : '');

  const onSave = async () => {
    if (lines.length === 0) { Alert.alert('Нет позиций', 'Сначала добавьте замеры'); return; }
    setSaving(true);
    try {
      const payload: CreateQuotePayload = {
        order_id: idStr,
        prepayment_percent: 0.5,
        items: lines.map(l => ({
          room_name: l.m.room_name,
          window_name: l.m.window_name,
          window_width_cm: l.m.width_cm ?? 0,
          window_height_cm: l.m.height_cm ?? 0,
          fabric_meters: l.m.curtain_meters ?? 0,
          tulle_meters: l.m.tulle_meters ?? 0,
          line_total: (parseFloat(l.price) || 0) * l.qty,
        })),
      };
      await createQuote(payload);
      Alert.alert('Готово', 'КП создано');
      router.back();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось создать КП');
    } finally { setSaving(false); }
  };

  if (loading) return <View style={s.centered}><ActivityIndicator color="#60CCED" size="large" /></View>;
  if (error) {
    return (
      <View style={s.centered}>
        <Text style={s.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.retryBtn}><Text style={s.retryText}>Назад</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.6}>
          <Text style={s.back}>Назад</Text>
        </TouchableOpacity>
        <Text style={s.title}>Заказ №{orderNum}</Text>

        {lines.length === 0 && <Text style={s.empty}>Нет замеров для расчёта</Text>}

        {lines.map((l, i) => {
          const dims = l.m.width_cm && l.m.height_cm ? ` (${l.m.width_cm}x${l.m.height_cm})` : '';
          const curtain = fabricLabel(l.m.curtain_fabric);
          const tulle = fabricLabel(l.m.tulle_fabric);
          return (
            <View key={l.m.id} style={s.card}>
              <Text style={s.cardRoom}>{l.m.room_name}</Text>
              <Text style={s.cardLine}>{l.m.window_name}{dims}</Text>
              {Boolean(curtain) && <Text style={s.cardLine}><Text style={s.b}>Шторы: </Text>{curtain}{l.m.curtain_meters ? ` (${l.m.curtain_meters} м)` : ''}</Text>}
              {Boolean(tulle) && <Text style={s.cardLine}><Text style={s.b}>Тюль: </Text>{tulle}{l.m.tulle_meters ? ` (${l.m.tulle_meters} м)` : ''}</Text>}
              {Boolean(l.m.mounting_type) && <Text style={s.cardLine}><Text style={s.b}>Тип крепления: </Text>{l.m.mounting_type}</Text>}
              {Boolean(l.m.notes) && <Text style={s.cardLine}><Text style={s.b}>Комментарий: </Text>{l.m.notes}</Text>}

              <View style={s.cardControls}>
                <View style={s.qtyRow}>
                  <Text style={s.b}>Количество: </Text>
                  <TouchableOpacity style={s.qtyBtn} onPress={() => setQty(i, -1)}><Icon name="minus" size={16} color="#475569" /></TouchableOpacity>
                  <Text style={s.qtyVal}>{l.qty}</Text>
                  <TouchableOpacity style={s.qtyBtn} onPress={() => setQty(i, +1)}><Icon name="plus" size={16} color="#475569" /></TouchableOpacity>
                </View>
                <View style={s.priceRow}>
                  <Text style={s.b}>Стоимость: </Text>
                  <TextInput style={s.priceInput} value={l.price} onChangeText={(v) => setPrice(i, v)} keyboardType="numeric" placeholder="0" placeholderTextColor="#94A3B8" />
                  <Text style={s.cardLine}> ₸</Text>
                </View>
              </View>
            </View>
          );
        })}

        {/* Totals */}
        <View style={s.totalsBox}>
          <Text style={s.totalLabel}>Итоговая стоимость:</Text>
          <Text style={s.totalValue}>{money(total)} ₸</Text>

          <View style={s.prepayRow}>
            <Text style={s.prepayLabel}>Размер предоплаты:</Text>
            <Text style={s.prepayAmount}>{money(prepayAmount)} ₸</Text>
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
        </View>

        <TouchableOpacity style={[s.btn, lines.length === 0 && s.btnDisabled]} onPress={onSave} disabled={lines.length === 0 || saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Сохранить</Text>}
        </TouchableOpacity>
      </ScrollView>
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
  title: { fontSize: 26, fontFamily: 'TTNormsPro-Bold', color: '#0F172A', textAlign: 'center', marginBottom: 18 },
  empty: { fontSize: 15, color: '#94A3B8', textAlign: 'center', marginTop: 24 },

  card: { backgroundColor: '#FAFBFC', borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#EEF1F4' },
  cardRoom: { fontSize: 19, color: '#0F172A', fontFamily: 'TTNormsPro-Regular', marginBottom: 2 },
  cardLine: { fontSize: 16, color: '#0F172A', fontFamily: 'TTNormsPro-Regular', lineHeight: 24 },
  b: { fontFamily: 'TTNormsPro-Bold' },
  cardControls: { marginTop: 12, gap: 10 },
  qtyRow: { flexDirection: 'row', alignItems: 'center' },
  qtyBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#E9E9E9', alignItems: 'center', justifyContent: 'center', marginHorizontal: 6 },
  qtyVal: { fontSize: 17, color: '#0F172A', fontFamily: 'TTNormsPro-Medium', minWidth: 20, textAlign: 'center' },
  priceRow: { flexDirection: 'row', alignItems: 'center' },
  priceInput: { minWidth: 90, backgroundColor: '#E9E9E9', borderRadius: 8, height: 40, paddingHorizontal: 12, fontSize: 17, color: '#0F172A', fontFamily: 'TTNormsPro-Bold' },

  totalsBox: { marginTop: 10, marginBottom: 8 },
  totalLabel: { fontSize: 20, color: '#0F172A', fontFamily: 'TTNormsPro-Regular' },
  totalValue: { fontSize: 22, color: '#0F172A', fontFamily: 'TTNormsPro-Bold', marginTop: 4 },
  prepayRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  prepayLabel: { fontSize: 18, color: '#0F172A', fontFamily: 'TTNormsPro-Regular' },
  prepayInput: { width: 76, backgroundColor: '#E9E9E9', borderRadius: 10, height: 44, marginLeft: 12, paddingHorizontal: 14, fontSize: 17, color: '#0F172A', fontFamily: 'TTNormsPro-Regular' },
  prepayAmount: { fontSize: 18, color: '#0F172A', fontFamily: 'TTNormsPro-Bold', marginLeft: 16 },
  depositInput: { flex: 1, backgroundColor: '#E9E9E9', borderRadius: 10, height: 44, marginLeft: 12, paddingHorizontal: 14, fontSize: 17, color: '#0F172A', fontFamily: 'TTNormsPro-Regular' },
  prepayUnit: { fontSize: 18, color: '#0F172A', fontFamily: 'TTNormsPro-Regular', marginLeft: 10 },

  btn: { backgroundColor: '#60CCED', borderRadius: 12, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#FFFFFF', fontSize: 17, fontFamily: 'TTNormsPro-Regular' },
});

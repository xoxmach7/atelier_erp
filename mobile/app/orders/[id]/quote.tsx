import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Platform, StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fetchMeasurements, createQuote, fetchOrderExecution, fetchQuotes,
  type MeasurementsList, type CreateQuotePayload,
} from '../../../src/api/orders';
import { fetchFabricsList } from '../../../src/api/fabrics';

type Meas = MeasurementsList['results'][number];

interface Line {
  m: Meas;
  qty: number;
  /** Цена окна из уже сохранённого КП. Здесь она только показывается. */
  price: number;
}

function money(n: number): string {
  return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
}

export default function QuoteScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const idStr = String(id);
  const insets = useSafeAreaInsets();

  const [orderNum, setOrderNum] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [fabricNames, setFabricNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [meas, fabrics, exec, quotes] = await Promise.all([
          fetchMeasurements(idStr),
          fetchFabricsList().catch(() => []),
          fetchOrderExecution(idStr).catch(() => null),
          fetchQuotes(idStr).catch(() => null),
        ]);

        // Цена окна считается сервером из выбранных тканей (метраж × цена за
        // метр) и приходит в calculated_price. Если КП уже сохранено и цену
        // правили руками, приоритет у сохранённой — иначе правка терялась бы
        // при каждом открытии экрана.
        const existing = quotes?.results?.[0] ?? null;
        const priceOf = (m: Meas): number => {
          const hit = existing?.items?.find(
            it => it.room_name === m.room_name && it.window_name === m.window_name,
          );
          const saved = parseFloat(hit?.line_total ?? '0') || 0;
          if (saved > 0) return saved;
          return parseFloat(m.calculated_price ?? '0') || 0;
        };

        setLines(meas.results.map(m => ({
          m,
          qty: Math.max(1, Math.round(Number(m.quantity ?? 1))),
          price: priceOf(m),
        })));
        const map: Record<string, string> = {};
        fabrics.forEach(f => { map[f.id] = f.name; });
        setFabricNames(map);
        if (exec) setOrderNum(exec.order_number?.match(/\d+$/)?.[0] ?? exec.order_number ?? '');
      } catch (e: any) {
        setError(e?.message ?? 'Не удалось загрузить замеры');
      } finally { setLoading(false); }
    })();
  }, [idStr]);

  // Цена окна уже включает количество (line_total из КП), поэтому на qty
  // не домножаем — иначе повторяющиеся окна считались бы дважды.
  const total = useMemo(
    () => lines.reduce((sum, l) => sum + l.price, 0),
    [lines],
  );

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
          line_total: l.price,
        })),
      };
      const quote = await createQuote(payload);
      router.replace(`/orders/${idStr}/quote-summary?quoteId=${quote.id}`);
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
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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

              {/* Сводка, а не форма: количество и цена приходят из «Позиций». */}
              <View style={s.cardControls}>
                <Text style={s.cardLine}><Text style={s.b}>Количество: </Text>{l.qty}</Text>
                <Text style={s.priceValue}>{money(l.price)} ₸</Text>
              </View>
            </View>
          );
        })}

        {/* Totals — только итог; предоплата/оплата задаются на след. экране КП */}
        <View style={s.totalsBox}>
          <Text style={s.totalLabel}>Предытог:</Text>
          <Text style={s.totalValue}>{money(total)} ₸</Text>
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
  cardControls: {
    marginTop: 12, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceValue: { fontSize: 18, color: '#0F172A', fontFamily: 'TTNormsPro-Bold' },

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

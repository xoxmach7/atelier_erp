import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
  StyleSheet, Platform, StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthContext } from '../../src/context/AuthContext';
import {
  fetchOrderExecution, fetchQuotes, deleteOrder,
  type OrderExecution, type QuoteDTO,
} from '../../src/api/orders';
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

        <View style={s.actionsRow}>
          <IconButton name="edit" size={40} onPress={() => router.push(`/orders/${idStr}/edit`)} />
          <IconButton name="trash" size={40} onPress={onDelete} />
        </View>

        {/* Address card */}
        <View style={s.addrCard}>
          <Text style={s.addrLine}><Text style={s.addrLabel}>Адрес: </Text>{addressText(data)}</Text>
          <Text style={[s.addrLine, { marginTop: 14 }]}><Text style={s.addrLabel}>Дата замера: </Text>{fmtDate(data.measurement_date)}</Text>
        </View>

        {/* Measurements section */}
        <Text style={s.sectionTitle}>Замеры</Text>
        <View style={s.toolRow}>
          <TouchableOpacity style={s.kpBtn} onPress={() => router.push(`/orders/${idStr}/quote`)} activeOpacity={0.85}>
            <Icon name="doc" size={18} color="#fff" />
            <Text style={s.kpBtnText}>Создать КП</Text>
          </TouchableOpacity>
          <View style={s.toolIcons}>
            <IconButton name="plus" size={38} onPress={() => router.push(`/orders/measurement-new?orderId=${idStr}`)} />
            <IconButton name="tenge" size={38} onPress={() => router.push(`/orders/${idStr}/quote`)} />
            <IconButton name="search" size={38} onPress={() => {}} />
          </View>
        </View>

        {measurements.length === 0 ? (
          <Text style={s.empty}>Замеры ещё не добавлены</Text>
        ) : (
          measurements.map((m) => {
            const dims = m.width_cm && m.height_cm ? ` (${m.width_cm}x${m.height_cm})` : '';
            const price = priceFor(m.room_name, m.window_name);
            return (
              <TouchableOpacity key={m.id} style={s.mRow} activeOpacity={0.6}
                onPress={() => router.push(`/orders/${idStr}/measurements`)}>
                <View style={{ flex: 1 }}>
                  <Text style={s.mRoom}>{m.room_name}</Text>
                  <Text style={s.mWindow}>{m.window_name}{dims}</Text>
                </View>
                {price != null && <Text style={s.mPrice}>{fmtMoney(price)} ₸</Text>}
                <View style={s.mMenu}><Icon name="dots" size={20} color="#94A3B8" /></View>
              </TouchableOpacity>
            );
          })
        )}
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
  title: { fontSize: 28, fontFamily: 'TTNormsPro-Bold', color: '#0F172A', textAlign: 'center' },
  actionsRow: { flexDirection: 'row', gap: 16, justifyContent: 'flex-end', marginTop: 12 },

  addrCard: { backgroundColor: '#F1F3F5', borderRadius: 16, padding: 20, marginTop: 18 },
  addrLine: { fontSize: 17, color: '#0F172A', fontFamily: 'TTNormsPro-Regular', lineHeight: 24 },
  addrLabel: { fontFamily: 'TTNormsPro-Bold' },

  sectionTitle: { fontSize: 28, fontFamily: 'TTNormsPro-Bold', color: '#0F172A', marginTop: 26 },
  toolRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 8 },
  kpBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#60CCED', borderRadius: 10, paddingHorizontal: 16, height: 40 },
  kpBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'TTNormsPro-Regular' },
  toolIcons: { flexDirection: 'row', gap: 12 },

  empty: { fontSize: 15, color: '#94A3B8', fontFamily: 'TTNormsPro-Regular', textAlign: 'center', marginTop: 24 },
  mRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#EEF1F4',
  },
  mRoom: { fontSize: 17, color: '#0F172A', fontFamily: 'TTNormsPro-Regular' },
  mWindow: { fontSize: 16, color: '#475569', fontFamily: 'TTNormsPro-Regular', marginTop: 2 },
  mPrice: { fontSize: 18, color: '#0F172A', fontFamily: 'TTNormsPro-Bold' },
  mMenu: { width: 22, alignItems: 'center' },
});

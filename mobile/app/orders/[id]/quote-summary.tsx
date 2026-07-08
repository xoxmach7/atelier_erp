import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Platform, StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  fetchQuotes, updateQuote, generateQuotePdf, type QuoteDTO,
} from '../../../src/api/orders';
import { getBaseUrl } from '../../../src/api/client';

function money(v: string | number): string {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (!n || isNaN(n)) return '0';
  return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
}

function absoluteUrl(url: string): string {
  return url.startsWith('http') ? url : `${getBaseUrl()}${url}`;
}

export default function QuoteSummaryScreen() {
  const router = useRouter();
  const { id, quoteId } = useLocalSearchParams<{ id: string; quoteId: string }>();
  const idStr = String(id);
  const quoteIdStr = String(quoteId);

  const [quote, setQuote] = useState<QuoteDTO | null>(null);
  const [installation, setInstallation] = useState('0');
  const [discountPct, setDiscountPct] = useState('0');
  const [prepayPct, setPrepayPct] = useState('50');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchQuotes(idStr);
      const q = list.results.find(r => r.id === quoteIdStr) ?? list.results[0] ?? null;
      if (q) {
        setQuote(q);
        setInstallation(String(Math.round(parseFloat(q.installation_cost) || 0)));
        setPrepayPct(String(Math.round((parseFloat(q.prepayment_percent) || 0.5) * 100)));
        if (q.subtotal && parseFloat(q.subtotal) > 0) {
          const pct = (parseFloat(q.discount_amount) || 0) / parseFloat(q.subtotal) * 100;
          setDiscountPct(String(Math.round(pct)));
        }
      } else {
        setError('КП не найдено');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось загрузить КП');
    } finally { setLoading(false); }
  }, [idStr, quoteIdStr]);

  useEffect(() => { load(); }, [load]);

  const subtotal = quote ? parseFloat(quote.subtotal) || 0 : 0;
  const installationNum = parseFloat(installation) || 0;
  const discountPctNum = parseFloat(discountPct) || 0;
  const prepayPctNum = parseFloat(prepayPct) || 0;

  const total = useMemo(() => {
    const beforeDiscount = subtotal + installationNum;
    return beforeDiscount * (1 - discountPctNum / 100);
  }, [subtotal, installationNum, discountPctNum]);

  const prepayAmount = useMemo(() => total * (prepayPctNum / 100), [total, prepayPctNum]);

  const onDownload = async () => {
    if (!quote) return;
    setSaving(true);
    try {
      const discountAmount = (subtotal + installationNum) * (discountPctNum / 100);
      await updateQuote(quote.id, {
        order_id: idStr,
        installation_cost: installationNum,
        discount_amount: discountAmount,
        prepayment_percent: prepayPctNum / 100,
        items: quote.items.map(it => ({
          room_name: it.room_name,
          window_name: it.window_name,
          window_width_cm: it.window_width_cm,
          window_height_cm: it.window_height_cm,
          fabric_meters: parseFloat(it.fabric_meters) || 0,
          tulle_meters: parseFloat(it.tulle_meters) || 0,
          line_total: parseFloat(it.line_total) || 0,
        })),
      });

      setDownloading(true);
      const res = await generateQuotePdf(quote.id);
      const url = absoluteUrl(res.pdf_url);
      const fileUri = FileSystem.documentDirectory + `${quote.quote_number || 'kp'}.pdf`;
      const download = await FileSystem.downloadAsync(url, fileUri);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(download.uri, { mimeType: 'application/pdf' });
      } else {
        Alert.alert('Готово', 'PDF сохранён на устройстве');
      }
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось скачать КП');
    } finally {
      setSaving(false);
      setDownloading(false);
    }
  };

  if (loading) return <View style={s.centered}><ActivityIndicator color="#60CCED" size="large" /></View>;
  if (error || !quote) {
    return (
      <View style={s.centered}>
        <Text style={s.errorText}>{error ?? 'КП не найдено'}</Text>
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
        <Text style={s.title}>Заказ №{quote.order_number?.match(/\d+$/)?.[0] ?? quote.order_number}</Text>

        <View style={s.row}>
          <Text style={s.label}>Установка:</Text>
          <TextInput
            style={s.input}
            value={installation}
            onChangeText={setInstallation}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="#94A3B8"
          />
          <Text style={s.unit}>₸</Text>
        </View>

        <View style={s.row}>
          <Text style={s.label}>Скидка:</Text>
          <TextInput
            style={s.input}
            value={discountPct}
            onChangeText={setDiscountPct}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="#94A3B8"
          />
          <Text style={s.unit}>%</Text>
        </View>

        <View style={s.totalRow}>
          <Text style={s.totalLabel}>ИТОГО</Text>
          <Text style={s.totalValue}>{money(total)} ₸</Text>
        </View>

        <View style={s.row}>
          <Text style={s.label}>Предоплата:</Text>
          <TextInput
            style={s.input}
            value={prepayPct}
            onChangeText={setPrepayPct}
            keyboardType="numeric"
            placeholder="50"
            placeholderTextColor="#94A3B8"
          />
          <Text style={s.unit}>%</Text>
        </View>
        <Text style={s.prepayHint}>{money(prepayAmount)} ₸</Text>

        <TouchableOpacity
          style={[s.btn, (saving || downloading) && s.btnDisabled]}
          onPress={onDownload}
          disabled={saving || downloading}
          activeOpacity={0.85}
        >
          {saving || downloading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.btnText}>Скачать КП</Text>
          )}
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
  title: { fontSize: 26, fontFamily: 'TTNormsPro-Bold', color: '#0F172A', textAlign: 'center', marginBottom: 28 },

  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  label: { fontSize: 18, color: '#0F172A', fontFamily: 'TTNormsPro-Regular', flex: 1 },
  input: { width: 100, backgroundColor: '#E9E9E9', borderRadius: 10, height: 44, paddingHorizontal: 14, fontSize: 17, color: '#0F172A', fontFamily: 'TTNormsPro-Regular', textAlign: 'right' },
  unit: { fontSize: 18, color: '#0F172A', fontFamily: 'TTNormsPro-Regular', marginLeft: 10, width: 24 },

  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, marginTop: 4 },
  totalLabel: { fontSize: 20, fontFamily: 'TTNormsPro-Bold', color: '#0F172A' },
  totalValue: { fontSize: 24, fontFamily: 'TTNormsPro-Bold', color: '#0F172A' },

  prepayHint: { fontSize: 15, color: '#94A3B8', fontFamily: 'TTNormsPro-Regular', textAlign: 'right', marginTop: -14, marginBottom: 22 },

  btn: { backgroundColor: '#60CCED', borderRadius: 12, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#FFFFFF', fontSize: 17, fontFamily: 'TTNormsPro-Regular' },
});

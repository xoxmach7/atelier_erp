import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, Alert, Modal,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, Icon } from '../../src/components/Icon';
import { EmptyState } from '../../src/components/EmptyState';
import {
  fetchInventoryItems, deleteInventoryItem, addInventoryQuantity,
  UNIT_LABELS, type InventoryItem,
} from '../../src/api/inventory';

function money(v: string | number): string {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (!n || isNaN(n)) return '0';
  return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
}

function qty(v: string): string {
  const n = parseFloat(v) || 0;
  // Целые показываем без хвоста: 67 м, а не 67.00 м
  return Number.isInteger(n) ? String(n) : String(n);
}

export default function InventoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Модалка «Добавить количество»
  const [addTarget, setAddTarget] = useState<InventoryItem | null>(null);
  const [addAmount, setAddAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setItems(await fetchInventoryItems());
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось загрузить материалы');
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const visible = search.trim()
    ? items.filter(i =>
        i.name?.toLowerCase().includes(search.toLowerCase()) ||
        i.sku?.toLowerCase().includes(search.toLowerCase()))
    : items;

  const openMenu = (item: InventoryItem) => {
    Alert.alert(item.name, item.sku || '', [
      { text: 'Добавить количество', onPress: () => { setAddAmount(''); setAddTarget(item); } },
      { text: 'Редактировать', onPress: () => router.push(`/inventory/${item.id}`) },
      {
        text: 'Удалить', style: 'destructive',
        onPress: () => {
          Alert.alert('Удалить позицию?', item.name, [
            { text: 'Отмена', style: 'cancel' },
            {
              text: 'Удалить', style: 'destructive',
              onPress: async () => {
                try { await deleteInventoryItem(item.id); await load(); }
                catch (e: any) { Alert.alert('Ошибка', e?.message ?? 'Не удалось удалить'); }
              },
            },
          ]);
        },
      },
      { text: 'Отмена', style: 'cancel' },
    ]);
  };

  const saveAddQuantity = async () => {
    if (!addTarget) return;
    const delta = parseFloat(addAmount);
    if (!delta || delta <= 0) { Alert.alert('Ошибка', 'Введите количество больше нуля'); return; }
    setSaving(true);
    try {
      await addInventoryQuantity(addTarget, delta);
      setAddTarget(null);
      await load();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось добавить количество');
    } finally { setSaving(false); }
  };

  return (
    <View style={s.screen}>
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.6}>
          <Text style={s.back}>Назад</Text>
        </TouchableOpacity>
        <Text style={s.title}>Материалы</Text>
        <View style={s.iconRow}>
          <IconButton name="scan" size={38} onPress={() => router.push('/inventory/scan')} />
          <IconButton name="plus" size={38} onPress={() => router.push('/inventory/new')} />
          <IconButton name="search" size={38} onPress={() => setShowSearch(v => !v)} />
        </View>
      </View>

      {showSearch && (
        <View style={s.searchBar}>
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Артикул или наименование"
            placeholderTextColor="#94A3B8"
            autoFocus
          />
        </View>
      )}

      {loading && <View style={s.centered}><ActivityIndicator color="#60CCED" size="large" /></View>}
      {Boolean(error) && !loading && (
        <View style={s.centered}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={s.retryBtn}><Text style={s.retryText}>Повторить</Text></TouchableOpacity>
        </View>
      )}

      {!loading && !error && (
        <FlatList
          data={visible}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          onRefresh={load}
          refreshing={loading}
          ListEmptyComponent={
            <EmptyState title="Нет позиций" subtitle={search ? 'Попробуйте другой запрос' : 'Добавьте первую позицию'} />
          }
          renderItem={({ item }) => {
            const unit = UNIT_LABELS[item.unit] ?? item.unit_display ?? '';
            return (
              // ⋮ — соседний Touchable, не вложенный (иначе нажатие перехватывает строка)
              <View style={s.row}>
                <TouchableOpacity
                  style={s.rowMain}
                  activeOpacity={0.6}
                  onPress={() => router.push(`/inventory/${item.id}`)}
                >
                  <View style={{ flex: 1 }}>
                    {Boolean(item.sku) && <Text style={s.sku}>{item.sku}</Text>}
                    <Text style={s.name}>{item.name}</Text>
                    <Text style={s.price}>{money(item.price_per_unit)} ₸/{unit}</Text>
                  </View>
                  <View style={s.qtyBox}>
                    <Text style={[s.qty, item.is_low_stock && s.qtyLow]}>
                      {qty(item.quantity)} {unit}
                    </Text>
                    {item.is_low_stock && <Text style={s.lowLabel}>На исходе</Text>}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.menuBtn}
                  onPress={() => openMenu(item)}
                  activeOpacity={0.6}
                  hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                >
                  <Icon name="dots" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      {/* Добавить количество */}
      <Modal visible={addTarget !== null} transparent animationType="fade" onRequestClose={() => setAddTarget(null)}>
        <TouchableOpacity style={s.modalBg} activeOpacity={1} onPress={() => setAddTarget(null)}>
          <TouchableOpacity style={s.modalCard} activeOpacity={1}>
            <Text style={s.modalTitle}>Добавить количество</Text>
            {addTarget && (
              <Text style={s.modalSub}>
                {addTarget.name} · сейчас {qty(addTarget.quantity)} {UNIT_LABELS[addTarget.unit] ?? ''}
              </Text>
            )}
            <View style={s.modalRow}>
              <TextInput
                style={s.modalInput}
                value={addAmount}
                onChangeText={setAddAmount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#94A3B8"
                autoFocus
              />
              <Text style={s.modalUnit}>{addTarget ? UNIT_LABELS[addTarget.unit] ?? '' : ''}</Text>
            </View>
            <TouchableOpacity
              style={[s.modalBtn, saving && s.modalBtnDisabled]}
              onPress={saveAddQuantity}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.modalBtnText}>Добавить</Text>}
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  errorText: { color: '#EF4444', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#F4F4F4', borderRadius: 8 },
  retryText: { fontSize: 14, color: '#0F172A', fontFamily: 'TTNormsPro-Medium' },

  header: { paddingHorizontal: 20, paddingBottom: 14 },
  back: { fontSize: 16, color: '#94A3B8', fontFamily: 'TTNormsPro-Regular', marginBottom: 8 },
  title: { fontSize: 30, fontFamily: 'TTNormsPro-Regular', color: '#0F172A', textAlign: 'center', letterSpacing: -0.5 },
  iconRow: { flexDirection: 'row', gap: 16, marginTop: 14, justifyContent: 'flex-end' },

  searchBar: { paddingHorizontal: 20, paddingBottom: 10 },
  searchInput: {
    backgroundColor: '#F1F3F5', borderRadius: 10, height: 44,
    paddingHorizontal: 16, fontSize: 15, color: '#0F172A', fontFamily: 'TTNormsPro-Regular',
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FAFBFC', paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: '#EEF1F4',
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 },
  sku: { fontSize: 16, color: '#0F172A', fontFamily: 'TTNormsPro-Regular' },
  name: { fontSize: 16, color: '#0F172A', fontFamily: 'TTNormsPro-Regular', marginTop: 2 },
  price: { fontSize: 16, color: '#0F172A', fontFamily: 'TTNormsPro-Regular', marginTop: 2 },
  qtyBox: { alignItems: 'flex-end' },
  qty: { fontSize: 18, color: '#0F172A', fontFamily: 'TTNormsPro-Bold' },
  qtyLow: { color: '#F59E0B' },
  lowLabel: { fontSize: 14, color: '#F59E0B', fontFamily: 'TTNormsPro-Medium', marginTop: 2 },
  menuBtn: { width: 40, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24 },
  modalTitle: { fontSize: 20, fontFamily: 'TTNormsPro-Bold', color: '#0F172A', textAlign: 'center' },
  modalSub: { fontSize: 15, color: '#64748B', fontFamily: 'TTNormsPro-Regular', textAlign: 'center', marginTop: 8 },
  modalRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  modalInput: {
    flex: 1, backgroundColor: '#E9E9E9', borderRadius: 10, height: 48,
    paddingHorizontal: 16, fontSize: 17, color: '#0F172A', fontFamily: 'TTNormsPro-Regular',
  },
  modalUnit: { fontSize: 17, color: '#0F172A', fontFamily: 'TTNormsPro-Regular', marginLeft: 12, minWidth: 40 },
  modalBtn: {
    backgroundColor: '#60CCED', borderRadius: 12, height: 52,
    alignItems: 'center', justifyContent: 'center', marginTop: 20,
  },
  modalBtnDisabled: { opacity: 0.5 },
  modalBtnText: { color: '#FFFFFF', fontSize: 17, fontFamily: 'TTNormsPro-Regular' },
});

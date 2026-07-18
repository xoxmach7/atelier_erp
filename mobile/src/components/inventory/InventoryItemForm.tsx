import { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Modal, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UNIT_LABELS, type InventoryUnit, type InventoryItemPayload } from '../../api/inventory';

const UNITS: InventoryUnit[] = ['m', 'pcs', 'pack'];

export interface InventoryFormInitial {
  sku?: string;
  name?: string;
  unit?: InventoryUnit;
  pricePerUnit?: string;
  lowStockThreshold?: string;
}

export function InventoryItemForm({
  mode, initial, submitting, onSubmit,
}: {
  mode: 'create' | 'edit';
  initial?: InventoryFormInitial;
  submitting: boolean;
  onSubmit: (payload: InventoryItemPayload) => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [sku, setSku] = useState(initial?.sku ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [unit, setUnit] = useState<InventoryUnit | ''>(initial?.unit ?? '');
  const [price, setPrice] = useState(initial?.pricePerUnit ?? '');
  const [threshold, setThreshold] = useState(initial?.lowStockThreshold ?? '');
  const [unitOpen, setUnitOpen] = useState(false);
  const [error, setError] = useState('');

  const valid = sku.trim() && name.trim() && unit;

  const submit = () => {
    setError('');
    if (!valid) { setError('Заполните артикул, наименование и единицу измерения'); return; }
    onSubmit({
      sku: sku.trim(),
      name: name.trim(),
      unit: unit as InventoryUnit,
      price_per_unit: price.trim() ? price.trim() : 0,
      low_stock_threshold: threshold.trim() ? threshold.trim() : 0,
    });
  };

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.6}>
          <Text style={s.back}>Назад</Text>
        </TouchableOpacity>
        <Text style={s.title}>{mode === 'create' ? 'Создание позиции' : 'Редактирование'}</Text>

        <Text style={s.label}>1.  Артикул <Text style={s.req}>*</Text></Text>
        <TextInput style={s.input} value={sku} onChangeText={setSku} placeholderTextColor="#94A3B8" />

        <Text style={[s.label, { marginTop: 22 }]}>2.  Наименование <Text style={s.req}>*</Text></Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholderTextColor="#94A3B8" />

        <Text style={[s.label, { marginTop: 22 }]}>3.  Единица измерения <Text style={s.req}>*</Text></Text>
        <TouchableOpacity style={s.select} activeOpacity={0.7} onPress={() => setUnitOpen(true)}>
          <Text style={[s.selectText, !unit && s.selectPlaceholder]}>
            {unit ? UNIT_LABELS[unit] : 'Выберите единицу'}
          </Text>
          <Text style={s.selectArrow}>▾</Text>
        </TouchableOpacity>

        <Text style={[s.label, { marginTop: 22 }]}>4.  Стоимость за м/шт.</Text>
        <View style={s.priceRow}>
          <TextInput
            style={[s.input, { flex: 1 }]}
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            placeholderTextColor="#94A3B8"
          />
          <Text style={s.unitSign}>₸</Text>
        </View>

        <Text style={[s.label, { marginTop: 22 }]}>5.  Минимальный запас</Text>
        <Text style={s.hint}>Ниже этого остатка позиция помечается «На исходе»</Text>
        <TextInput
          style={s.input}
          value={threshold}
          onChangeText={setThreshold}
          keyboardType="numeric"
          placeholderTextColor="#94A3B8"
        />

        {Boolean(error) && <Text style={s.error}>{error}</Text>}

        <TouchableOpacity
          style={[s.btn, !valid && s.btnDisabled]}
          onPress={submit}
          disabled={!valid || submitting}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>{mode === 'create' ? 'Создать' : 'Сохранить'}</Text>}
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={unitOpen} transparent animationType="fade" onRequestClose={() => setUnitOpen(false)}>
        <TouchableOpacity style={s.modalBg} activeOpacity={1} onPress={() => setUnitOpen(false)}>
          <View style={s.modalCard}>
            <FlatList
              data={UNITS}
              keyExtractor={u => u}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.modalItem}
                  onPress={() => { setUnit(item); setUnitOpen(false); }}
                >
                  <Text style={s.modalItemText}>{UNIT_LABELS[item]}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingHorizontal: 20 },
  back: { fontSize: 16, color: '#94A3B8', fontFamily: 'TTNormsPro-Regular', marginBottom: 10 },
  title: { fontSize: 30, fontFamily: 'TTNormsPro-Regular', color: '#0F172A', textAlign: 'center', letterSpacing: -0.5, marginBottom: 24 },
  label: { fontSize: 18, color: '#0F172A', fontFamily: 'TTNormsPro-Regular', marginBottom: 10 },
  req: { color: '#EF4444' },
  hint: { fontSize: 14, color: '#94A3B8', fontFamily: 'TTNormsPro-Regular', marginTop: -4, marginBottom: 10 },
  input: {
    backgroundColor: '#E9E9E9', borderRadius: 12, height: 50, paddingHorizontal: 16,
    fontSize: 16, color: '#0F172A', fontFamily: 'TTNormsPro-Regular',
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  unitSign: { fontSize: 20, color: '#0F172A', fontFamily: 'TTNormsPro-Regular', width: 24, textAlign: 'center' },

  select: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#E9E9E9', borderRadius: 12, height: 50, paddingHorizontal: 16,
  },
  selectText: { fontSize: 16, color: '#0F172A', fontFamily: 'TTNormsPro-Regular', flex: 1 },
  selectPlaceholder: { color: '#94A3B8' },
  selectArrow: { fontSize: 16, color: '#64748B', marginLeft: 8 },

  error: { color: '#EF4444', fontSize: 14, marginTop: 16 },
  btn: {
    backgroundColor: '#60CCED', borderRadius: 12, height: 52,
    alignItems: 'center', justifyContent: 'center', marginTop: 28,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#FFFFFF', fontSize: 17, fontFamily: 'TTNormsPro-Regular' },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 28 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 16, maxHeight: '70%', paddingVertical: 8 },
  modalItem: { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  modalItemText: { fontSize: 16, color: '#0F172A', fontFamily: 'TTNormsPro-Regular' },
});

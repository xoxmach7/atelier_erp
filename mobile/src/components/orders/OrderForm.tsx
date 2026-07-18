import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Modal, FlatList, Platform, StatusBar, KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Icon, IconButton } from '../Icon';
import { fetchCustomers } from '../../api/customers';
import { fetchStaff, type StaffUser } from '../../api/staff';
import type { Customer } from '../../types/customer';
import type { CreateOrderPayload } from '../../api/orders';

export interface OrderFormInitial {
  customerId?: string; customerName?: string;
  designerId?: number; designerName?: string;
  measurementDate?: string;   // YYYY-MM-DD
  plannedCompletion?: string; // YYYY-MM-DD
  city?: string; street?: string; building?: string; apartment?: string; notes?: string;
}

function isoToDisplay(iso?: string): string {
  if (!iso) return '';
  const p = iso.split('T')[0].split('-');
  if (p.length !== 3) return '';
  return `${p[2]}.${p[1]}.${p[0]}`;
}
function displayToIso(d: string): string | undefined {
  const m = d.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return undefined;
  return `${m[3]}-${m[2]}-${m[1]}`;
}
function isoToDate(iso?: string): Date {
  if (!iso) return new Date();
  const parsed = new Date(iso.split('T')[0]);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}
function dateToDisplay(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${date.getFullYear()}`;
}

export function OrderForm({
  mode, initial, submitting, onSubmit,
}: {
  mode: 'create' | 'edit';
  initial?: OrderFormInitial;
  submitting: boolean;
  onSubmit: (payload: CreateOrderPayload) => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [customerId, setCustomerId] = useState(initial?.customerId ?? '');
  const [customerName, setCustomerName] = useState(initial?.customerName ?? '');
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showResults, setShowResults] = useState(false);

  const [designerId, setDesignerId] = useState<number | undefined>(initial?.designerId);
  const [designerName, setDesignerName] = useState(initial?.designerName ?? '');
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [designerOpen, setDesignerOpen] = useState(false);

  const [measureDate, setMeasureDate] = useState(isoToDisplay(initial?.measurementDate));
  const [completion, setCompletion] = useState(isoToDisplay(initial?.plannedCompletion));
  const [showMeasureDatePicker, setShowMeasureDatePicker] = useState(false);
  const [showCompletionDatePicker, setShowCompletionDatePicker] = useState(false);
  const [city, setCity] = useState(initial?.city ?? '');
  const [street, setStreet] = useState(initial?.street ?? '');
  const [building, setBuilding] = useState(initial?.building ?? '');
  const [apartment, setApartment] = useState(initial?.apartment ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCustomers().then(r => setCustomers(r.results)).catch(() => {});
    fetchStaff('designer').then(setStaff).catch(() => {});
  }, []);

  const results = search.trim()
    ? customers.filter(c => c.full_name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search))
    : customers;

  const selectCustomer = (c: Customer) => {
    setCustomerId(c.id); setCustomerName(c.full_name);
    setShowResults(false); setSearch('');
  };

  const submit = () => {
    setError('');
    if (!customerId) { setError('Выберите клиента'); return; }
    const payload: CreateOrderPayload = {
      customer_id: customerId,
      responsible_user_id: designerId,
      measurement_date: displayToIso(measureDate),
      planned_completion: displayToIso(completion),
      installation_address_city: city.trim(),
      installation_address_street: street.trim(),
      installation_address_building: building.trim(),
      installation_address_apartment: apartment.trim(),
      installation_address_notes: notes.trim(),
    };
    onSubmit(payload);
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
        <Text style={s.title}>{mode === 'create' ? 'Создание заказа' : 'Редактирование'}</Text>

        {/* 1. Client */}
        <Text style={s.label}>1.  Клиент <Text style={s.req}>*</Text></Text>
        {customerId ? (
          <View style={s.selectedClient}>
            <Text style={s.selectedClientText}>{customerName}</Text>
            <TouchableOpacity onPress={() => { setCustomerId(''); setCustomerName(''); }}>
              <Icon name="plus" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.clientRow}>
            <View style={s.searchField}>
              <Icon name="search" size={18} color="#94A3B8" />
              <TextInput
                style={s.searchInput}
                placeholder="Фамилия/телефон"
                placeholderTextColor="#94A3B8"
                value={search}
                onChangeText={(t) => { setSearch(t); setShowResults(true); }}
                onFocus={() => setShowResults(true)}
              />
            </View>
            <IconButton name="userAdd" size={44} onPress={() => router.push('/clients/new')} />
          </View>
        )}
        {!customerId && showResults && results.length > 0 && (
          <View style={s.dropdown}>
            {results.slice(0, 6).map(c => (
              <TouchableOpacity key={c.id} style={s.dropItem} onPress={() => selectCustomer(c)}>
                <Text style={s.dropItemName}>{c.full_name}</Text>
                <Text style={s.dropItemPhone}>{c.phone}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 2. Designer */}
        <Text style={[s.label, { marginTop: 22 }]}>2.  Дизайнер</Text>
        <TouchableOpacity style={s.select} onPress={() => setDesignerOpen(true)} activeOpacity={0.7}>
          <Text style={[s.selectText, !designerName && s.selectPlaceholder]}>
            {designerName || 'Выберите дизайнера'}
          </Text>
          <Text style={s.selectArrow}>▾</Text>
        </TouchableOpacity>

        {/* 3 & 4. Dates */}
        <View style={s.row2}>
          <View style={s.col}>
            <Text style={[s.label, { marginTop: 22 }]}>3.  Дата замера</Text>
            <TouchableOpacity style={s.dateField} onPress={() => setShowMeasureDatePicker(true)} activeOpacity={0.7}>
              <Icon name="calendar" size={18} color="#94A3B8" />
              <Text style={[s.dateInput, !measureDate && s.selectPlaceholder]}>
                {measureDate || '__.__.____'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={s.col}>
            <Text style={[s.label, { marginTop: 22 }]}>4.  Завершение</Text>
            <TouchableOpacity style={s.dateField} onPress={() => setShowCompletionDatePicker(true)} activeOpacity={0.7}>
              <Icon name="calendar" size={18} color="#94A3B8" />
              <Text style={[s.dateInput, !completion && s.selectPlaceholder]}>
                {completion || '__.__.____'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {showMeasureDatePicker && (
          Platform.OS === 'ios' ? (
            <Modal visible transparent animationType="fade" onRequestClose={() => setShowMeasureDatePicker(false)}>
              <TouchableOpacity style={s.modalBg} activeOpacity={1} onPress={() => setShowMeasureDatePicker(false)}>
                <View style={s.datePickerCard}>
                  <DateTimePicker
                    value={isoToDate(displayToIso(measureDate))}
                    mode="date"
                    display="spinner"
                    onChange={(_event, selected) => { if (selected) setMeasureDate(dateToDisplay(selected)); }}
                  />
                  <TouchableOpacity style={s.datePickerDone} onPress={() => setShowMeasureDatePicker(false)}>
                    <Text style={s.datePickerDoneText}>Готово</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Modal>
          ) : (
            <DateTimePicker
              value={isoToDate(displayToIso(measureDate))}
              mode="date"
              display="default"
              onChange={(_event, selected) => {
                setShowMeasureDatePicker(false);
                if (selected) setMeasureDate(dateToDisplay(selected));
              }}
            />
          )
        )}
        {showCompletionDatePicker && (
          Platform.OS === 'ios' ? (
            <Modal visible transparent animationType="fade" onRequestClose={() => setShowCompletionDatePicker(false)}>
              <TouchableOpacity style={s.modalBg} activeOpacity={1} onPress={() => setShowCompletionDatePicker(false)}>
                <View style={s.datePickerCard}>
                  <DateTimePicker
                    value={isoToDate(displayToIso(completion))}
                    mode="date"
                    display="spinner"
                    onChange={(_event, selected) => { if (selected) setCompletion(dateToDisplay(selected)); }}
                  />
                  <TouchableOpacity style={s.datePickerDone} onPress={() => setShowCompletionDatePicker(false)}>
                    <Text style={s.datePickerDoneText}>Готово</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Modal>
          ) : (
            <DateTimePicker
              value={isoToDate(displayToIso(completion))}
              mode="date"
              display="default"
              onChange={(_event, selected) => {
                setShowCompletionDatePicker(false);
                if (selected) setCompletion(dateToDisplay(selected));
              }}
            />
          )
        )}

        {/* 5. Address */}
        <Text style={[s.label, { marginTop: 22 }]}>5.  Адрес установки</Text>
        <View style={s.row2}>
          <TextInput style={[s.input, s.col]} placeholder="Город" placeholderTextColor="#94A3B8" value={city} onChangeText={setCity} />
          <TextInput style={[s.input, s.col]} placeholder="Улица" placeholderTextColor="#94A3B8" value={street} onChangeText={setStreet} />
        </View>
        <View style={[s.row2, { marginTop: 12 }]}>
          <TextInput style={[s.input, s.col]} placeholder="Дом" placeholderTextColor="#94A3B8" value={building} onChangeText={setBuilding} />
          <TextInput style={[s.input, s.col]} placeholder="Квартира" placeholderTextColor="#94A3B8" value={apartment} onChangeText={setApartment} />
        </View>
        <TextInput style={[s.input, { marginTop: 12 }]} placeholder="Примечание" placeholderTextColor="#94A3B8" value={notes} onChangeText={setNotes} />

        {Boolean(error) && <Text style={s.error}>{error}</Text>}

        <TouchableOpacity style={[s.btn, !customerId && s.btnDisabled]} onPress={submit} disabled={!customerId || submitting} activeOpacity={0.85}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{mode === 'create' ? 'Создать' : 'Сохранить'}</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* Designer modal */}
      <Modal visible={designerOpen} transparent animationType="fade" onRequestClose={() => setDesignerOpen(false)}>
        <TouchableOpacity style={s.modalBg} activeOpacity={1} onPress={() => setDesignerOpen(false)}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Дизайнер</Text>
            <FlatList
              data={staff}
              keyExtractor={u => String(u.id)}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.modalItem} onPress={() => { setDesignerId(item.id); setDesignerName(item.full_name); setDesignerOpen(false); }}>
                  <Text style={s.modalItemText}>{item.full_name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={s.modalEmpty}>Список пуст</Text>}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  content: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 16 : 20,
    paddingBottom: 32,
  },
  back: { fontSize: 16, color: '#94A3B8', fontFamily: 'TTNormsPro-Regular', marginBottom: 10 },
  title: { fontSize: 30, fontFamily: 'TTNormsPro-Regular', color: '#0F172A', textAlign: 'center', letterSpacing: -0.5, marginBottom: 24 },
  label: { fontSize: 18, color: '#0F172A', fontFamily: 'TTNormsPro-Regular', marginBottom: 10 },
  req: { color: '#EF4444' },

  input: { backgroundColor: '#E9E9E9', borderRadius: 12, height: 50, paddingHorizontal: 16, fontSize: 16, color: '#0F172A', fontFamily: 'TTNormsPro-Regular' },
  row2: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },

  clientRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  searchField: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E9E9E9', borderRadius: 12, height: 50, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontSize: 16, color: '#0F172A', fontFamily: 'TTNormsPro-Regular' },
  selectedClient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#E0F2FE', borderRadius: 12, height: 50, paddingHorizontal: 16 },
  selectedClientText: { fontSize: 16, color: '#0F172A', fontFamily: 'TTNormsPro-Medium' },
  dropdown: { backgroundColor: '#FFFFFF', borderRadius: 12, marginTop: 6, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  dropItem: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  dropItemName: { fontSize: 15, color: '#0F172A', fontFamily: 'TTNormsPro-Regular' },
  dropItemPhone: { fontSize: 13, color: '#94A3B8', marginTop: 2 },

  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#E9E9E9', borderRadius: 12, height: 50, paddingHorizontal: 16 },
  selectText: { fontSize: 16, color: '#0F172A', fontFamily: 'TTNormsPro-Regular' },
  selectPlaceholder: { color: '#94A3B8' },
  selectArrow: { fontSize: 16, color: '#64748B' },

  dateField: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E9E9E9', borderRadius: 12, height: 50, paddingHorizontal: 14 },
  dateInput: { flex: 1, fontSize: 16, color: '#0F172A', fontFamily: 'TTNormsPro-Regular' },
  datePickerCard: { backgroundColor: '#FFFFFF', borderRadius: 16, paddingBottom: 8, marginHorizontal: 28 },
  datePickerDone: { alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  datePickerDoneText: { fontSize: 16, color: '#0369A1', fontFamily: 'TTNormsPro-Bold' },

  error: { color: '#EF4444', fontSize: 14, marginTop: 16 },
  btn: { backgroundColor: '#60CCED', borderRadius: 12, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 28 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#FFFFFF', fontSize: 17, fontFamily: 'TTNormsPro-Regular' },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 28 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 16, maxHeight: '70%', paddingVertical: 8 },
  modalTitle: { fontSize: 18, fontFamily: 'TTNormsPro-Bold', color: '#0F172A', paddingHorizontal: 20, paddingVertical: 12 },
  modalItem: { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  modalItemText: { fontSize: 16, color: '#0F172A', fontFamily: 'TTNormsPro-Regular' },
  modalEmpty: { padding: 20, color: '#94A3B8', textAlign: 'center' },
});

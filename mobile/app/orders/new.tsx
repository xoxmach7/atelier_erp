import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthContext } from '../../src/context/AuthContext';
import { createOrder } from '../../src/api/orders';

interface FormState {
  client_name: string;
  client_phone: string;
  designer: string;
  date_measurement: string;
  date_completion: string;
  city: string;
  street: string;
  building: string;
  apartment: string;
  comment: string;
}

interface FormErrors {
  client_name?: string;
  client_phone?: string;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}{required ? <Text style={s.req}> *</Text> : null}</Text>
      {children}
    </View>
  );
}

function Input(props: React.ComponentProps<typeof TextInput> & { error?: boolean }) {
  const { error, style, ...rest } = props;
  return (
    <TextInput
      style={[s.input, error && s.inputError, style]}
      placeholderTextColor="#94A3B8"
      {...rest}
    />
  );
}

export default function NewOrderScreen() {
  const router = useRouter();
  const { primaryRole } = useAuthContext();
  const [form, setForm] = useState<FormState>({
    client_name: '', client_phone: '', designer: '',
    date_measurement: '', date_completion: '',
    city: '', street: '', building: '', apartment: '', comment: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const set = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field in errors) setErrors(prev => ({ ...prev, [field]: undefined }));
    setSubmitError(null);
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!form.client_name.trim()) next.client_name = 'Введите имя клиента';
    if (!form.client_phone.trim()) next.client_phone = 'Введите телефон';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (primaryRole !== 'owner' && primaryRole !== 'designer') {
      setSubmitError('Недостаточно прав');
      return;
    }
    setLoading(true);
    try {
      const address = [form.city, form.street, form.building, form.apartment]
        .filter(Boolean).join(', ');
      const order = await createOrder({
        client_name: form.client_name.trim(),
        client_phone: form.client_phone.trim(),
        address,
        deadline: form.date_completion || '',
        comment: form.comment.trim() || undefined,
      });
      router.replace(`/orders/${order.id}`);
    } catch (err) {
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as any).message) : 'Не удалось создать заказ';
      setSubmitError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Создание заказа</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* 1. Клиент */}
        <Text style={s.sectionNum}>1. Клиент *</Text>
        <View style={s.searchWrap}>
          <View style={s.searchIcon}>
            <Text style={s.searchIconText}>⌕</Text>
          </View>
          <TextInput
            style={s.searchInput}
            placeholder="Имя клиента"
            placeholderTextColor="#94A3B8"
            value={form.client_name}
            onChangeText={v => set('client_name', v)}
            autoCapitalize="words"
          />
        </View>
        {errors.client_name && <Text style={s.errorText}>{errors.client_name}</Text>}
        <View style={s.gap8} />
        <Input
          placeholder="Телефон"
          value={form.client_phone}
          onChangeText={v => set('client_phone', v)}
          keyboardType="phone-pad"
          error={Boolean(errors.client_phone)}
        />
        {errors.client_phone && <Text style={s.errorText}>{errors.client_phone}</Text>}

        {/* 2. Дизайнер */}
        <Text style={[s.sectionNum, { marginTop: 20 }]}>2. Дизайнер</Text>
        <View style={s.selectWrap}>
          <Text style={form.designer ? s.selectText : s.selectPlaceholder}>
            {form.designer || 'Выбрать дизайнера'}
          </Text>
          <Text style={s.selectArrow}>›</Text>
        </View>

        {/* 3. Даты */}
        <Text style={[s.sectionNum, { marginTop: 20 }]}>3. Даты</Text>
        <View style={s.row2}>
          <View style={s.col2}>
            <Text style={s.subLabel}>Дата замера</Text>
            <Input
              placeholder="ДД.ММ.ГГ"
              value={form.date_measurement}
              onChangeText={v => set('date_measurement', v)}
              style={s.inputSm}
            />
          </View>
          <View style={s.col2}>
            <Text style={s.subLabel}>Завершение</Text>
            <Input
              placeholder="ДД.ММ.ГГ"
              value={form.date_completion}
              onChangeText={v => set('date_completion', v)}
              style={s.inputSm}
            />
          </View>
        </View>

        {/* 4. Адрес установки */}
        <Text style={[s.sectionNum, { marginTop: 20 }]}>4. Адрес установки</Text>
        <Input placeholder="Город" value={form.city} onChangeText={v => set('city', v)} />
        <View style={s.gap8} />
        <Input placeholder="Улица" value={form.street} onChangeText={v => set('street', v)} />
        <View style={s.gap8} />
        <View style={s.row2}>
          <Input
            placeholder="Дом"
            value={form.building}
            onChangeText={v => set('building', v)}
            style={s.col2}
          />
          <Input
            placeholder="Кв./Офис"
            value={form.apartment}
            onChangeText={v => set('apartment', v)}
            style={s.col2}
          />
        </View>

        {/* Error */}
        {submitError && (
          <View style={s.errorBox}>
            <Text style={s.errorBoxText}>{submitError}</Text>
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[s.btn, loading && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={s.btnText}>Создать</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 56, paddingBottom: 12,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  backText: { fontSize: 26, color: '#60CCED', lineHeight: 30 },
  headerTitle: { fontSize: 17, fontFamily: 'TTNormsPro-Bold', color: '#0F172A' },
  scroll: { padding: 16, paddingTop: 20 },
  sectionNum: { fontSize: 14, fontFamily: 'TTNormsPro-Bold', color: '#0F172A', marginBottom: 8 },
  subLabel: { fontSize: 12, color: '#64748B', fontFamily: 'TTNormsPro-Regular', marginBottom: 4 },

  // search input
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F4F4F4', borderRadius: 10, height: 44,
    paddingHorizontal: 12, marginBottom: 0,
  },
  searchIcon: { marginRight: 8 },
  searchIconText: { fontSize: 18, color: '#94A3B8' },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A', fontFamily: 'TTNormsPro-Regular' },

  // input
  input: {
    backgroundColor: '#F4F4F4', borderRadius: 10, height: 44,
    paddingHorizontal: 14, fontSize: 14, color: '#0F172A',
    fontFamily: 'TTNormsPro-Regular',
  },
  inputSm: { height: 44, fontSize: 13 },
  inputError: { borderWidth: 1, borderColor: '#EF4444', backgroundColor: '#FFF5F5' },

  // select
  selectWrap: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F4F4F4', borderRadius: 10, height: 44, paddingHorizontal: 14,
  },
  selectText: { fontSize: 14, color: '#0F172A', fontFamily: 'TTNormsPro-Regular' },
  selectPlaceholder: { fontSize: 14, color: '#94A3B8', fontFamily: 'TTNormsPro-Regular' },
  selectArrow: { fontSize: 20, color: '#94A3B8' },

  // layout
  row2: { flexDirection: 'row', gap: 10 },
  col2: { flex: 1 },
  gap8: { height: 8 },
  field: { marginBottom: 12 },
  label: { fontSize: 13, color: '#475569', fontFamily: 'TTNormsPro-Medium', marginBottom: 6 },
  req: { color: '#EF4444' },

  // errors
  errorText: { fontSize: 11, color: '#EF4444', marginTop: 4, fontFamily: 'TTNormsPro-Regular' },
  errorBox: {
    backgroundColor: '#FEF2F2', borderRadius: 8, padding: 12, marginTop: 12,
  },
  errorBoxText: { fontSize: 13, color: '#EF4444', fontFamily: 'TTNormsPro-Regular' },

  // button
  btn: {
    backgroundColor: '#60CCED', borderRadius: 12, height: 52,
    alignItems: 'center', justifyContent: 'center', marginTop: 24,
  },
  btnText: { fontSize: 16, color: '#FFFFFF', fontFamily: 'TTNormsPro-Bold' },
});

import { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, StatusBar, KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { createCustomer } from '../../src/api/customers';

export default function NewClientScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const valid = fullName.trim().length > 1 && phone.trim().length >= 6;

  const onSave = async () => {
    setError('');
    if (!valid) { setError('Заполните имя и телефон'); return; }
    setSaving(true);
    try {
      await createCustomer({ full_name: fullName.trim(), phone: phone.trim() });
      router.back();
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось создать клиента');
    } finally { setSaving(false); }
  };

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Добавление клиента</Text>

        <Text style={s.label}>1.  Фамилия и имя <Text style={s.req}>*</Text></Text>
        <TextInput style={s.input} value={fullName} onChangeText={setFullName} placeholder="" placeholderTextColor="#94A3B8" />

        <Text style={[s.label, { marginTop: 24 }]}>2.  Телефон <Text style={s.req}>*</Text></Text>
        <TextInput
          style={s.input} value={phone} onChangeText={setPhone}
          placeholder="+7 (777) 000-00-00" placeholderTextColor="#94A3B8" keyboardType="phone-pad"
        />

        {Boolean(error) && <Text style={s.error}>{error}</Text>}
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity style={[s.btn, !valid && s.btnDisabled]} onPress={onSave} disabled={!valid || saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Создать</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  content: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 24 : 28,
    paddingBottom: 24,
  },
  title: { fontSize: 30, fontFamily: 'TTNormsPro-Regular', color: '#0F172A', letterSpacing: -0.5, marginBottom: 28 },
  label: { fontSize: 18, color: '#0F172A', fontFamily: 'TTNormsPro-Regular', marginBottom: 10 },
  req: { color: '#EF4444' },
  input: { backgroundColor: '#E9E9E9', borderRadius: 12, height: 52, paddingHorizontal: 16, fontSize: 16, color: '#0F172A', fontFamily: 'TTNormsPro-Regular' },
  error: { color: '#EF4444', fontSize: 14, marginTop: 16 },
  footer: { paddingHorizontal: 20, paddingBottom: 24, paddingTop: 8 },
  btn: { backgroundColor: '#60CCED', borderRadius: 12, height: 52, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#FFFFFF', fontSize: 17, fontFamily: 'TTNormsPro-Regular' },
});

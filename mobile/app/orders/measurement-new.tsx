import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createMeasurement } from '../../src/api/orders';

function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      style={s.input}
      placeholderTextColor="#94A3B8"
      {...props}
    />
  );
}

function SelectField({ value, placeholder, onPress }: { value: string; placeholder: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={s.select} onPress={onPress} activeOpacity={0.7}>
      <Text style={value ? s.selectText : s.selectPlaceholder}>{value || placeholder}</Text>
      <Text style={s.selectArrow}>›</Text>
    </TouchableOpacity>
  );
}

export default function MeasurementNewScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const [room, setRoom] = useState('');
  const [window_name, setWindowName] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [fabric, setFabric] = useState('');
  const [tulle, setTulle] = useState('');
  const [mounting, setMounting] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!room.trim() || !window_name.trim()) {
      setError('Заполните помещение и окно');
      return;
    }
    if (!orderId) { setError('Не указан заказ'); return; }
    setLoading(true);
    setError(null);
    try {
      await createMeasurement(orderId, {
        room_name: room.trim(),
        window_number: window_name.trim(),
        width: width || 0,
        height: height || 0,
        fabric_name: fabric.trim() || undefined,
        mounting_type: mounting.trim() || undefined,
        comment: comment.trim() || undefined,
      });
      router.back();
    } catch (err: any) {
      setError(err?.message ?? 'Не удалось сохранить замер');
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
        <Text style={s.headerTitle}>Создание замера</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* 1. Комната */}
        <Text style={s.num}>1. Комната *</Text>
        <Input
          placeholder="Например: Гостиная"
          value={room}
          onChangeText={setRoom}
          autoCapitalize="sentences"
        />

        {/* 2. Окно */}
        <Text style={[s.num, s.mt]}>2. Окно *</Text>
        <Input
          placeholder="Например: Окно 1 (100×150)"
          value={window_name}
          onChangeText={setWindowName}
        />

        {/* 3. Ширина + Высота */}
        <Text style={[s.num, s.mt]}>3. Размеры (см)</Text>
        <View style={s.row2}>
          <View style={s.col2}>
            <Text style={s.subLabel}>Ширина (см) *</Text>
            <Input
              placeholder="100"
              value={width}
              onChangeText={setWidth}
              keyboardType="numeric"
            />
          </View>
          <View style={s.col2}>
            <Text style={s.subLabel}>4. Высота (см)</Text>
            <Input
              placeholder="150"
              value={height}
              onChangeText={setHeight}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* 5. Ткань штор */}
        <Text style={[s.num, s.mt]}>5. Ткань штор</Text>
        <SelectField
          value={fabric}
          placeholder="Выбрать ткань"
        />
        <View style={s.gap6} />
        <Input
          placeholder="Или введите вручную"
          value={fabric}
          onChangeText={setFabric}
        />

        {/* 6. Тюль */}
        <Text style={[s.num, s.mt]}>6. Тюль</Text>
        <SelectField value={tulle} placeholder="Выбрать тюль" />
        <View style={s.gap6} />
        <Input
          placeholder="Или введите вручную"
          value={tulle}
          onChangeText={setTulle}
        />

        {/* 7. Тип крепления */}
        <Text style={[s.num, s.mt]}>7. Тип крепления</Text>
        <SelectField value={mounting} placeholder="Выбрать тип" />

        {/* 8. Комментарий */}
        <Text style={[s.num, s.mt]}>8. Комментарии по задаче</Text>
        <TextInput
          style={s.textarea}
          placeholder="Пожелания клиента, особенности монтажа..."
          placeholderTextColor="#94A3B8"
          value={comment}
          onChangeText={setComment}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Error */}
        {Boolean(error) && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
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
            : <Text style={s.btnText}>Сохранить замер</Text>
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
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  backBtn: { width: 36 },
  backText: { fontSize: 26, color: '#60CCED', lineHeight: 30 },
  headerTitle: { fontSize: 17, fontFamily: 'TTNormsPro-Bold', color: '#0F172A' },
  scroll: { padding: 16, paddingTop: 20 },

  num: { fontSize: 14, fontFamily: 'TTNormsPro-Bold', color: '#0F172A', marginBottom: 8 },
  mt: { marginTop: 20 },
  subLabel: { fontSize: 12, color: '#64748B', fontFamily: 'TTNormsPro-Regular', marginBottom: 4 },
  gap6: { height: 6 },

  input: {
    backgroundColor: '#F4F4F4', borderRadius: 10, height: 44,
    paddingHorizontal: 14, fontSize: 14, color: '#0F172A',
    fontFamily: 'TTNormsPro-Regular',
  },
  textarea: {
    backgroundColor: '#F4F4F4', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#0F172A', fontFamily: 'TTNormsPro-Regular',
    minHeight: 80,
  },
  select: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F4F4F4', borderRadius: 10, height: 44, paddingHorizontal: 14,
  },
  selectText: { fontSize: 14, color: '#0F172A', fontFamily: 'TTNormsPro-Regular' },
  selectPlaceholder: { fontSize: 14, color: '#94A3B8', fontFamily: 'TTNormsPro-Regular' },
  selectArrow: { fontSize: 20, color: '#94A3B8' },

  row2: { flexDirection: 'row', gap: 10 },
  col2: { flex: 1 },

  errorBox: { backgroundColor: '#FEF2F2', borderRadius: 8, padding: 12, marginTop: 12 },
  errorText: { fontSize: 13, color: '#EF4444', fontFamily: 'TTNormsPro-Regular' },

  btn: {
    backgroundColor: '#60CCED', borderRadius: 12, height: 52,
    alignItems: 'center', justifyContent: 'center', marginTop: 24,
  },
  btnText: { fontSize: 16, color: '#FFFFFF', fontFamily: 'TTNormsPro-Bold' },
});

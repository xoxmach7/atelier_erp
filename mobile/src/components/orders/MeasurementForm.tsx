import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Modal, FlatList, Platform, StatusBar, KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { fetchFabricsList, type FabricLite } from '../../api/fabrics';
import type { MeasurementPayload } from '../../api/orders';

const MOUNTING = ['Потолочный', 'Настенный', 'Профильный', 'Электрокарниз', 'Без карниза'];

export interface MeasurementInitial {
  room?: string; window?: string; width?: string; height?: string;
  curtainFabric?: string; curtainMeters?: string;
  tulleFabric?: string; tulleMeters?: string;
  mounting?: string; comment?: string;
}

function Select({ value, placeholder, options, onSelect }: {
  value: string; placeholder: string; options: string[]; onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity style={s.select} activeOpacity={0.7} onPress={() => setOpen(true)}>
        <Text style={[s.selectText, !value && s.selectPlaceholder]} numberOfLines={1}>{value || placeholder}</Text>
        <Text style={s.selectArrow}>▾</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={s.modalBg} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={s.modalCard}>
            <FlatList
              data={options}
              keyExtractor={(o, i) => o + i}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.modalItem} onPress={() => { onSelect(item); setOpen(false); }}>
                  <Text style={s.modalItemText}>{item}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={s.modalEmpty}>Список пуст</Text>}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

export function MeasurementForm({
  mode, initial, submitting, onSubmit,
}: {
  mode: 'create' | 'edit';
  initial?: MeasurementInitial;
  submitting: boolean;
  onSubmit: (payload: MeasurementPayload) => void;
}) {
  const router = useRouter();
  const [room, setRoom] = useState(initial?.room ?? '');
  const [windowName, setWindowName] = useState(initial?.window ?? '');
  const [width, setWidth] = useState(initial?.width ?? '');
  const [height, setHeight] = useState(initial?.height ?? '');
  const [curtain, setCurtain] = useState(initial?.curtainFabric ?? '');
  const [curtainM, setCurtainM] = useState(initial?.curtainMeters ?? '');
  const [tulle, setTulle] = useState(initial?.tulleFabric ?? '');
  const [tulleM, setTulleM] = useState(initial?.tulleMeters ?? '');
  const [mounting, setMounting] = useState(initial?.mounting ?? '');
  const [comment, setComment] = useState(initial?.comment ?? '');
  const [fabrics, setFabrics] = useState<FabricLite[]>([]);
  const [error, setError] = useState('');

  useEffect(() => { fetchFabricsList().then(setFabrics).catch(() => {}); }, []);
  const fabricNames = fabrics.map(f => f.name);

  const valid = room.trim() && windowName.trim() && width.trim() && height.trim();

  const submit = () => {
    setError('');
    if (!valid) { setError('Заполните комнату, окно, ширину и высоту'); return; }
    // Бэк MeasurementCreateSerializer принимает одну ткань. Тюль сохраняем в комментарии
    // (until backend измерений расширим на curtain+tulle).
    const tulleNote = tulle ? `Тюль: ${tulle}${tulleM ? ` ${tulleM}м` : ''}` : '';
    const fullComment = [comment.trim(), tulleNote].filter(Boolean).join('\n');
    const payload: MeasurementPayload = {
      room_name: room.trim(),
      window_number: windowName.trim(),
      width: width.trim(),
      height: height.trim(),
      fabric_type: curtain ? 'curtain' : '',
      fabric_name: curtain || undefined,
      fabric_meters: curtainM || undefined,
      mounting_type: mounting || undefined,
      comment: fullComment || undefined,
    };
    onSubmit(payload);
  };

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.6}>
          <Text style={s.back}>Назад</Text>
        </TouchableOpacity>
        <Text style={s.title}>{mode === 'create' ? 'Создание замера' : 'Редактирование'}</Text>

        <Text style={s.label}>1.  Комната <Text style={s.req}>*</Text></Text>
        <TextInput style={s.input} value={room} onChangeText={setRoom} placeholder="Например: Гостиная" placeholderTextColor="#94A3B8" />

        <Text style={[s.label, { marginTop: 22 }]}>2.  Окно/изделие <Text style={s.req}>*</Text></Text>
        <TextInput style={s.input} value={windowName} onChangeText={setWindowName} placeholder="Например: Окно 1" placeholderTextColor="#94A3B8" />

        <View style={s.row2}>
          <View style={s.col}>
            <Text style={[s.label, { marginTop: 22 }]}>3.  Ширина (см) <Text style={s.req}>*</Text></Text>
            <TextInput style={s.input} value={width} onChangeText={setWidth} keyboardType="numeric" placeholderTextColor="#94A3B8" />
          </View>
          <View style={s.col}>
            <Text style={[s.label, { marginTop: 22 }]}>4.  Высота (см) <Text style={s.req}>*</Text></Text>
            <TextInput style={s.input} value={height} onChangeText={setHeight} keyboardType="numeric" placeholderTextColor="#94A3B8" />
          </View>
        </View>

        {/* 5. Curtain fabric + meters */}
        <View style={s.fabricHead}>
          <Text style={[s.label, { marginTop: 22, marginBottom: 10 }]}>5.  Ткань штор</Text>
          <Text style={s.metersLabel}>метры</Text>
        </View>
        <View style={s.fabricRow}>
          <View style={{ flex: 1 }}>
            <Select value={curtain} placeholder="Выберите ткань" options={fabricNames} onSelect={setCurtain} />
          </View>
          <TextInput style={s.metersInput} value={curtainM} onChangeText={setCurtainM} keyboardType="numeric" placeholderTextColor="#94A3B8" />
        </View>

        {/* 6. Tulle fabric + meters */}
        <View style={s.fabricHead}>
          <Text style={[s.label, { marginTop: 22, marginBottom: 10 }]}>6.  Ткань тюля</Text>
          <Text style={s.metersLabel}>метры</Text>
        </View>
        <View style={s.fabricRow}>
          <View style={{ flex: 1 }}>
            <Select value={tulle} placeholder="Выберите ткань" options={fabricNames} onSelect={setTulle} />
          </View>
          <TextInput style={s.metersInput} value={tulleM} onChangeText={setTulleM} keyboardType="numeric" placeholderTextColor="#94A3B8" />
        </View>

        {/* 7. Mounting */}
        <Text style={[s.label, { marginTop: 22 }]}>7.  Тип крепления</Text>
        <Select value={mounting} placeholder="Выберите крепление" options={MOUNTING} onSelect={setMounting} />

        {/* 8. Comment */}
        <Text style={[s.label, { marginTop: 22 }]}>8.  Комментарии по изделию</Text>
        <TextInput style={[s.input, { height: 80, paddingTop: 14 }]} value={comment} onChangeText={setComment} placeholder="Примечание" placeholderTextColor="#94A3B8" multiline />

        {Boolean(error) && <Text style={s.error}>{error}</Text>}

        <TouchableOpacity style={[s.btn, !valid && s.btnDisabled]} onPress={submit} disabled={!valid || submitting} activeOpacity={0.85}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{mode === 'create' ? 'Создать' : 'Сохранить'}</Text>}
        </TouchableOpacity>
      </ScrollView>
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

  fabricHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  metersLabel: { fontSize: 16, color: '#64748B', fontFamily: 'TTNormsPro-Regular', marginBottom: 12 },
  fabricRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  metersInput: { width: 64, backgroundColor: '#E9E9E9', borderRadius: 12, height: 50, textAlign: 'center', fontSize: 16, color: '#0F172A', fontFamily: 'TTNormsPro-Regular' },

  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#E9E9E9', borderRadius: 12, height: 50, paddingHorizontal: 16 },
  selectText: { fontSize: 16, color: '#0F172A', fontFamily: 'TTNormsPro-Regular', flex: 1 },
  selectPlaceholder: { color: '#94A3B8' },
  selectArrow: { fontSize: 16, color: '#64748B', marginLeft: 8 },

  error: { color: '#EF4444', fontSize: 14, marginTop: 16 },
  btn: { backgroundColor: '#60CCED', borderRadius: 12, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 28 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#FFFFFF', fontSize: 17, fontFamily: 'TTNormsPro-Regular' },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 28 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 16, maxHeight: '70%', paddingVertical: 8 },
  modalItem: { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  modalItemText: { fontSize: 16, color: '#0F172A', fontFamily: 'TTNormsPro-Regular' },
  modalEmpty: { padding: 20, color: '#94A3B8', textAlign: 'center' },
});

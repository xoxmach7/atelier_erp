import { useState, useEffect } from 'react';
import { View, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MeasurementForm, type MeasurementInitial } from '../../src/components/orders/MeasurementForm';
import {
  fetchMeasurement, updateMeasurement,
  type MeasurementPayload, type MeasurementUpdatePayload,
} from '../../src/api/orders';
import { fetchFabricsList, type FabricLite } from '../../src/api/fabrics';

/**
 * Редактирование замера.
 *
 * Форма работает с тканями ПО ИМЕНИ (как на создании), а PATCH-эндпоинт
 * MeasurementViewSet принимает поля модели с UUID ткани — поэтому здесь
 * имя ↔ UUID переводится в обе стороны. Метраж — ручной ввод (авторасчёт
 * отключён 2026-07-20), отправляем как обычное поле.
 */
export default function EditMeasurementScreen() {
  const router = useRouter();
  const { id, orderId } = useLocalSearchParams<{ id: string; orderId: string }>();
  const idStr = String(id);

  const [initial, setInitial] = useState<MeasurementInitial | null>(null);
  const [fabrics, setFabrics] = useState<FabricLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [m, fabricList] = await Promise.all([
          fetchMeasurement(idStr),
          fetchFabricsList().catch(() => [] as FabricLite[]),
        ]);
        setFabrics(fabricList);
        setInitial({
          room: m.room_name,
          window: m.window_name,
          width: m.width_cm != null ? String(m.width_cm) : '',
          height: m.height_cm != null ? String(m.height_cm) : '',
          curtainFabric: m.curtain_fabric_details?.name ?? '',
          curtainMeters: m.curtain_meters ? String(parseFloat(m.curtain_meters)) : undefined,
          tulleFabric: m.tulle_fabric_details?.name ?? '',
          tulleMeters: m.tulle_meters ? String(parseFloat(m.tulle_meters)) : undefined,
          mounting: m.mounting_type ?? '',
          comment: m.notes ?? '',
        });
      } catch (e: any) {
        Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить замер');
        router.back();
      } finally { setLoading(false); }
    })();
  }, [idStr]);

  const fabricIdByName = (name?: string): string | null => {
    if (!name) return null;
    return fabrics.find(f => f.name.toLowerCase() === name.toLowerCase())?.id ?? null;
  };

  const onSubmit = async (payload: MeasurementPayload) => {
    setSubmitting(true);
    try {
      const body: MeasurementUpdatePayload = {
        room_name: payload.room_name,
        window_name: payload.window_number,
        width_cm: Number(payload.width),
        height_cm: Number(payload.height),
        mounting_type: payload.mounting_type ?? '',
        notes: payload.comment ?? '',
        curtain_fabric: fabricIdByName(payload.curtain_fabric_name),
        tulle_fabric: fabricIdByName(payload.tulle_fabric_name),
      };
      if (payload.curtain_meters !== undefined) body.curtain_meters = payload.curtain_meters;
      if (payload.tulle_meters !== undefined) body.tulle_meters = payload.tulle_meters;

      await updateMeasurement(idStr, body);
      router.back();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось сохранить замер');
      setSubmitting(false);
    }
  };

  if (loading || !initial) {
    return <View style={s.centered}><ActivityIndicator color="#60CCED" size="large" /></View>;
  }

  return <MeasurementForm mode="edit" initial={initial} submitting={submitting} onSubmit={onSubmit} />;
}

const s = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
});

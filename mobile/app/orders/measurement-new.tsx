import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MeasurementForm } from '../../src/components/orders/MeasurementForm';
import { createMeasurement, type MeasurementPayload } from '../../src/api/orders';

export default function NewMeasurementScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (payload: MeasurementPayload) => {
    if (!orderId) { Alert.alert('Ошибка', 'Не указан заказ'); return; }
    setSubmitting(true);
    try {
      await createMeasurement(String(orderId), payload);
      router.back();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось сохранить замер');
      setSubmitting(false);
    }
  };

  return <MeasurementForm mode="create" submitting={submitting} onSubmit={onSubmit} />;
}

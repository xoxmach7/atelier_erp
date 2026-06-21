import { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { OrderForm, type OrderFormInitial } from '../../../src/components/orders/OrderForm';
import { fetchOrderExecution, updateOrder, type CreateOrderPayload } from '../../../src/api/orders';

export default function EditOrderScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const idStr = String(id);
  const [initial, setInitial] = useState<OrderFormInitial | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const exec = await fetchOrderExecution(idStr);
        const a = exec.customer?.address;
        const addr = a && typeof a === 'object' ? a : {};
        setInitial({
          customerId: exec.customer?.id,
          customerName: exec.customer?.full_name,
          measurementDate: exec.measurement_date,
          plannedCompletion: exec.planned_completion,
          city: (addr as any).city ?? '',
          street: (addr as any).street ?? '',
          building: (addr as any).building ?? '',
          apartment: (addr as any).apartment ?? '',
        });
      } catch (e: any) {
        Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить заказ');
        setInitial({});
      }
    })();
  }, [idStr]);

  const onSubmit = async (payload: CreateOrderPayload) => {
    setSubmitting(true);
    try {
      await updateOrder(idStr, payload);
      router.back();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось сохранить');
      setSubmitting(false);
    }
  };

  if (!initial) {
    return <View style={s.centered}><ActivityIndicator color="#60CCED" size="large" /></View>;
  }
  return <OrderForm mode="edit" initial={initial} submitting={submitting} onSubmit={onSubmit} />;
}

const s = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
});

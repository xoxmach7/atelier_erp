import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { OrderForm } from '../../src/components/orders/OrderForm';
import { createOrder, type CreateOrderPayload } from '../../src/api/orders';

export default function NewOrderScreen() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (payload: CreateOrderPayload) => {
    setSubmitting(true);
    try {
      const order = await createOrder(payload);
      router.replace(`/orders/${order.id}`);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось создать заказ');
      setSubmitting(false);
    }
  };

  return <OrderForm mode="create" submitting={submitting} onSubmit={onSubmit} />;
}

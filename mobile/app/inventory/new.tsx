import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { InventoryItemForm } from '../../src/components/inventory/InventoryItemForm';
import { createInventoryItem, type InventoryItemPayload } from '../../src/api/inventory';

export default function NewInventoryItemScreen() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (payload: InventoryItemPayload) => {
    setSubmitting(true);
    try {
      await createInventoryItem(payload);
      router.back();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось создать позицию');
      setSubmitting(false);
    }
  };

  return <InventoryItemForm mode="create" submitting={submitting} onSubmit={onSubmit} />;
}

import { useState, useEffect } from 'react';
import { View, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  InventoryItemForm, type InventoryFormInitial,
} from '../../src/components/inventory/InventoryItemForm';
import {
  fetchInventoryItems, updateInventoryItem, type InventoryItemPayload,
} from '../../src/api/inventory';

export default function EditInventoryItemScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const idStr = String(id);

  const [initial, setInitial] = useState<InventoryFormInitial | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const items = await fetchInventoryItems();
        const item = items.find(i => i.id === idStr);
        if (!item) throw new Error('Позиция не найдена');
        setInitial({
          sku: item.sku,
          name: item.name,
          unit: item.unit,
          pricePerUnit: item.price_per_unit ? String(parseFloat(item.price_per_unit)) : '',
          lowStockThreshold: item.low_stock_threshold ? String(parseFloat(item.low_stock_threshold)) : '',
        });
      } catch (e: any) {
        Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить позицию');
        router.back();
      } finally { setLoading(false); }
    })();
  }, [idStr]);

  const onSubmit = async (payload: InventoryItemPayload) => {
    setSubmitting(true);
    try {
      await updateInventoryItem(idStr, payload);
      router.back();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось сохранить позицию');
      setSubmitting(false);
    }
  };

  if (loading || !initial) {
    return <View style={s.centered}><ActivityIndicator color="#60CCED" size="large" /></View>;
  }

  return <InventoryItemForm mode="edit" initial={initial} submitting={submitting} onSubmit={onSubmit} />;
}

const s = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
});

import { View, Text, StyleSheet } from 'react-native';
import { UNIT_LABELS, type InventoryItem } from '../../api/inventory';

function money(v: string): string {
  const n = parseFloat(v);
  if (!n || isNaN(n)) return '0';
  return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
}

function qty(v: string): string {
  const n = parseFloat(v) || 0;
  return Number.isInteger(n) ? String(n) : String(n);
}

/** Карточка результата скана QR — только просмотр, без права правки (сканирование
 * во всех трёх ролях, включая Склад, это просмотр, а не изменение остатка). */
export function InventoryQrCard({ item }: { item: InventoryItem }) {
  const unit = UNIT_LABELS[item.unit] ?? item.unit_display ?? '';
  return (
    <View style={s.card}>
      {Boolean(item.sku) && <Text style={s.sku}>{item.sku}</Text>}
      <Text style={s.name}>{item.name}</Text>
      {Boolean(item.category_display) && <Text style={s.category}>{item.category_display}</Text>}

      <View style={s.row}>
        <Text style={s.label}>Остаток</Text>
        <Text style={[s.value, item.is_low_stock && s.low]}>
          {qty(item.quantity)} {unit}
        </Text>
      </View>

      <View style={s.row}>
        <Text style={s.label}>Цена</Text>
        <Text style={s.value}>{money(item.price_per_unit)} ₸/{unit}</Text>
      </View>

      {item.is_low_stock && <Text style={s.lowLabel}>На исходе</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#FAFBFC', borderRadius: 16, padding: 20, margin: 20 },
  sku: { fontSize: 14, color: '#94A3B8', fontFamily: 'TTNormsPro-Regular' },
  name: { fontSize: 22, color: '#0F172A', fontFamily: 'TTNormsPro-Bold', marginTop: 4 },
  category: { fontSize: 15, color: '#475569', fontFamily: 'TTNormsPro-Regular', marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  label: { fontSize: 15, color: '#94A3B8', fontFamily: 'TTNormsPro-Regular' },
  value: { fontSize: 16, color: '#0F172A', fontFamily: 'TTNormsPro-Bold' },
  low: { color: '#F59E0B' },
  lowLabel: { fontSize: 13, color: '#F59E0B', fontFamily: 'TTNormsPro-Medium', marginTop: 8, textAlign: 'right' },
});

import { View, Text } from 'react-native';
import { spacing, radius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { colors } from '../../theme/colors';
import type { OrderExecution } from '../../api/orders';

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.base, marginBottom: spacing.sm }}>
      {title ? <Text style={{ fontSize: typography.sizes.sm, fontWeight: '500', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm }}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function OrderMeasurements({ data }: { data: OrderExecution }) {
  return (
    <>
      {data.measurements && data.measurements.length > 0 && (
        <Card title="Замеры">
          {data.measurements.map((m, i) => (
            <View key={m.id ?? i} style={[{ paddingVertical: spacing.sm }, i > 0 && { borderTopWidth: 0.5, borderTopColor: '#f0f0f0' }]}>
              <Text style={{ fontSize: typography.sizes.base, fontWeight: '500', color: colors.text, marginBottom: 2 }}>{m.room_name} — {m.window_name}</Text>
              {(m.width_cm || m.height_cm) && (
                <Text style={{ fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: 1 }}>{m.width_cm ?? '?'} × {m.height_cm ?? '?'} см</Text>
              )}
              {m.curtain_fabric && (
                <Text style={{ fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: 1 }}>Шторы: {m.curtain_fabric}{m.curtain_fabric_meters ? ` (${m.curtain_fabric_meters} м)` : ''}</Text>
              )}
              {m.tulle_fabric && (
                <Text style={{ fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: 1 }}>Тюль: {m.tulle_fabric}{m.tulle_fabric_meters ? ` (${m.tulle_fabric_meters} м)` : ''}</Text>
              )}
              {m.mounting_type && <Text style={{ fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: 1 }}>Крепление: {m.mounting_type}</Text>}
              {m.notes && <Text style={{ fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: 1 }}>Комментарий: {m.notes}</Text>}
            </View>
          ))}
        </Card>
      )}

      {data.items_to_sew && data.items_to_sew.length > 0 && (
        <Card title="На пошив">
          {data.items_to_sew.map((item, i) => (
            <View key={item.id ?? i} style={[{ paddingVertical: spacing.sm }, i > 0 && { borderTopWidth: 0.5, borderTopColor: '#f0f0f0' }]}>
              {item.room_name && <Text style={{ fontSize: typography.sizes.base, fontWeight: '500', color: colors.text, marginBottom: 2 }}>{item.room_name}{item.window_name ? ` — ${item.window_name}` : ''}</Text>}
              {item.curtain_fabric && <Text style={{ fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: 1 }}>Ткань: {item.curtain_fabric}</Text>}
              {item.tulle_fabric && <Text style={{ fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: 1 }}>Тюль: {item.tulle_fabric}</Text>}
              {item.sewing_type && <Text style={{ fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: 1 }}>Тип: {item.sewing_type}</Text>}
              {item.notes && <Text style={{ fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: 1 }}>{item.notes}</Text>}
            </View>
          ))}
        </Card>
      )}

      {data.items_to_install && data.items_to_install.length > 0 && (
        <Card title="На установку">
          {data.items_to_install.map((item, i) => (
            <View key={item.id ?? i} style={[{ paddingVertical: spacing.sm }, i > 0 && { borderTopWidth: 0.5, borderTopColor: '#f0f0f0' }]}>
              {item.room_name && <Text style={{ fontSize: typography.sizes.base, fontWeight: '500', color: colors.text, marginBottom: 2 }}>{item.room_name}{item.window_name ? ` — ${item.window_name}` : ''}</Text>}
              {item.product_type && <Text style={{ fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: 1 }}>{item.product_type}</Text>}
              {item.notes && <Text style={{ fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: 1 }}>{item.notes}</Text>}
            </View>
          ))}
        </Card>
      )}
    </>
  );
}

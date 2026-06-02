import { View, Text } from 'react-native';
import { spacing, radius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { colors } from '../../theme/colors';
import type { OrderExecution } from '../../api/orders';
import { formatAddress } from '../../utils/formatAddress';

function fmt(d?: string | null): string {
  if (!d) return '—';
  const p = d.split('T')[0].split('-');
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0].slice(2)}` : d;
}

function money(v: string | undefined): string {
  const n = parseFloat(v ?? '0');
  return isNaN(n) ? '—' : new Intl.NumberFormat('ru-RU').format(n) + ' ₸';
}

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 }}>
      <Text style={{ fontSize: typography.sizes.base, color: colors.textMuted }}>{label}</Text>
      <Text style={[{ fontSize: typography.sizes.base, color: colors.text, fontWeight: '400' }, accent && { color: colors.primary[500], fontWeight: '500' }]}>{value}</Text>
    </View>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.base, marginBottom: spacing.sm }}>
      {title ? <Text style={{ fontSize: typography.sizes.sm, fontWeight: '500', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm }}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function OrderSummaryCard({ data }: { data: OrderExecution }) {
  return (
    <>
      {/* Client + Status */}
      <Card>
        <Text style={{ fontSize: typography.sizes.xl, fontWeight: '500', color: colors.text, marginBottom: 2 }}>{data.customer.full_name}</Text>
        <Text style={{ fontSize: typography.sizes.base, color: colors.textMuted, marginBottom: 2 }}>{data.customer.phone}</Text>
        {data.customer.address ? <Text style={{ fontSize: typography.sizes.sm, color: colors.textMuted }}>{formatAddress(data.customer.address)}</Text> : null}
        <View style={{ height: 0.5, backgroundColor: '#e2e8f0', marginVertical: spacing.sm }} />
        <InfoRow label="Статус" value={data.status_label} accent />
        <InfoRow label="Материалы" value={data.material_readiness_label} />
        <InfoRow label="Производство" value={data.production_stage_label} />
        <InfoRow label="Выдача / установка" value={data.handover_stage_label} />
        {data.planned_completion && (
          <InfoRow label="Срок" value={fmt(data.planned_completion)} />
        )}
      </Card>

      {/* Payment */}
      <Card title="Оплата">
        <InfoRow label="Итого" value={money(data.total_amount)} />
        <InfoRow label="Оплачено" value={money(data.paid_amount)} />
        <InfoRow
          label="Остаток"
          value={money(data.balance_due)}
          accent={parseFloat(data.balance_due) > 0}
        />
        <InfoRow label="Статус оплаты" value={data.payment_state_label} />
      </Card>

      {/* Documents */}
      {(data.photo_report_status || data.completion_act_status) && (
        <Card title="Документы">
          {data.photo_report_status && (
            <InfoRow
              label={`Фотоотчёт (${data.photo_report_count ?? 0} фото)`}
              value={data.photo_report_status === 'uploaded' ? '✓ Загружен' : 'Не загружен'}
            />
          )}
          {data.completion_act_status && (
            <InfoRow
              label="АВР"
              value={data.signed_act_uploaded ? '✓ Подписан' : data.completion_act_status}
            />
          )}
        </Card>
      )}
    </>
  );
}

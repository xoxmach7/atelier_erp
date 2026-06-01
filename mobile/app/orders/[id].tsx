import { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useAuthContext } from '../../src/context/AuthContext';
import {
  fetchOrderExecution,
  changeOrderStatus,
  changeMaterialReadiness,
  changeProductionStage,
  changeHandoverStage,
  type OrderExecution,
} from '../../src/api/orders';
import { colors } from '../../src/theme/colors';
import { spacing, radius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

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
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, accent && styles.infoAccent]}>{value}</Text>
    </View>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

function Blocker({ text }: { text: string }) {
  return (
    <View style={styles.blockerRow}>
      <Text style={styles.blockerText}>⚠ {text}</Text>
    </View>
  );
}

export default function OrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { primaryRole } = useAuthContext();
  const [data, setData] = useState<OrderExecution | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const exec = await fetchOrderExecution(id as string);
      setData(exec);
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e
        ? String((e as { message: string }).message)
        : 'Не удалось загрузить заказ';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const doAction = useCallback(async (
    action: () => Promise<unknown>,
    successMsg: string,
  ) => {
    setActionLoading(true);
    try {
      await action();
      Alert.alert('Готово', successMsg);
      await load();
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e
        ? String((e as { message: string }).message)
        : 'Ошибка действия';
      Alert.alert('Ошибка', msg);
    } finally {
      setActionLoading(false);
    }
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary[500]} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Заказ не найден'}</Text>
        <TouchableOpacity onPress={load} style={{ marginTop: spacing.base }}>
          <Text style={styles.retryText}>Повторить</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const idStr = id as string;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.back}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.orderNum}>{data.order_number}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* Blockers */}
        {data.blockers?.map((b, i) => <Blocker key={i} text={b} />)}

        {/* Client + Status */}
        <Card>
          <Text style={styles.clientName}>{data.customer.full_name}</Text>
          <Text style={styles.clientPhone}>{data.customer.phone}</Text>
          {data.customer.address ? <Text style={styles.clientMeta}>{data.customer.address}</Text> : null}
          <View style={styles.divider} />
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

        {/* Measurements (designer view) */}
        {data.measurements && data.measurements.length > 0 && (
          <Card title="Замеры">
            {data.measurements.map((m, i) => (
              <View key={m.id ?? i} style={[styles.measureItem, i > 0 && styles.measureBorder]}>
                <Text style={styles.measureRoom}>{m.room_name} — {m.window_name}</Text>
                {(m.width_cm || m.height_cm) && (
                  <Text style={styles.measureMeta}>{m.width_cm ?? '?'} × {m.height_cm ?? '?'} см</Text>
                )}
                {m.curtain_fabric && (
                  <Text style={styles.measureMeta}>Шторы: {m.curtain_fabric}{m.curtain_fabric_meters ? ` (${m.curtain_fabric_meters} м)` : ''}</Text>
                )}
                {m.tulle_fabric && (
                  <Text style={styles.measureMeta}>Тюль: {m.tulle_fabric}{m.tulle_fabric_meters ? ` (${m.tulle_fabric_meters} м)` : ''}</Text>
                )}
                {m.mounting_type && <Text style={styles.measureMeta}>Крепление: {m.mounting_type}</Text>}
                {m.notes && <Text style={styles.measureMeta}>Комментарий: {m.notes}</Text>}
              </View>
            ))}
          </Card>
        )}

        {/* Items to sew (production view) */}
        {data.items_to_sew && data.items_to_sew.length > 0 && (
          <Card title="На пошив">
            {data.items_to_sew.map((item, i) => (
              <View key={item.id ?? i} style={[styles.measureItem, i > 0 && styles.measureBorder]}>
                {item.room_name && <Text style={styles.measureRoom}>{item.room_name}{item.window_name ? ` — ${item.window_name}` : ''}</Text>}
                {item.curtain_fabric && <Text style={styles.measureMeta}>Ткань: {item.curtain_fabric}</Text>}
                {item.tulle_fabric && <Text style={styles.measureMeta}>Тюль: {item.tulle_fabric}</Text>}
                {item.sewing_type && <Text style={styles.measureMeta}>Тип: {item.sewing_type}</Text>}
                {item.notes && <Text style={styles.measureMeta}>{item.notes}</Text>}
              </View>
            ))}
          </Card>
        )}

        {/* Items to install (installer view) */}
        {data.items_to_install && data.items_to_install.length > 0 && (
          <Card title="На установку">
            {data.items_to_install.map((item, i) => (
              <View key={item.id ?? i} style={[styles.measureItem, i > 0 && styles.measureBorder]}>
                {item.room_name && <Text style={styles.measureRoom}>{item.room_name}{item.window_name ? ` — ${item.window_name}` : ''}</Text>}
                {item.product_type && <Text style={styles.measureMeta}>{item.product_type}</Text>}
                {item.notes && <Text style={styles.measureMeta}>{item.notes}</Text>}
              </View>
            ))}
          </Card>
        )}

        {/* Warnings */}
        {data.warnings?.length > 0 && (
          <View style={styles.warningsBox}>
            {data.warnings.map((w, i) => (
              <Text key={i} style={styles.warningText}>• {w}</Text>
            ))}
          </View>
        )}

        {/* Role-based actions */}
        {actionLoading ? (
          <View style={styles.actionsBox}>
            <ActivityIndicator color={colors.primary[500]} />
          </View>
        ) : (
          <RoleActions
            idStr={idStr}
            data={data}
            role={primaryRole}
            doAction={doAction}
            router={router}
          />
        )}

      </ScrollView>
    </View>
  );
}

function RoleActions({
  idStr, data, role, doAction, router,
}: {
  idStr: string;
  data: OrderExecution;
  role: string;
  doAction: (fn: () => Promise<unknown>, msg: string) => Promise<void>;
  router: ReturnType<typeof useRouter>;
}) {
  const a = data.actions ?? {};

  const btn = (title: string, variant: 'primary' | 'secondary', fn: () => void) => (
    <View key={title} style={styles.actionItem}>
      <PrimaryButton title={title} variant={variant} onPress={fn} />
    </View>
  );

  const statusBtn = (label: string, newStatus: string, variant: 'primary' | 'secondary' = 'primary') =>
    btn(label, variant, () =>
      doAction(() => changeOrderStatus(idStr, newStatus), `Статус изменён: ${label}`)
    );

  // Owner / Admin
  if (role === 'owner') {
    return (
      <View style={styles.actionsBox}>
        {a.can_take_in_work && statusBtn('Взять в работу', 'in_work')}
        {a.can_start_production && statusBtn('Передать в производство', 'in_production')}
        {a.can_mark_ready && statusBtn('Отметить готовым', 'ready')}
        {a.can_start_installation && statusBtn('На установку / выдачу', 'on_installation')}
        {a.can_complete && statusBtn('Завершить заказ', 'completed')}
        {a.can_add_measurement && btn('Добавить замер', 'secondary', () =>
          router.push({ pathname: '/orders/measurement-new', params: { orderId: idStr } })
        )}
        {a.can_cancel && btn('Отменить заказ', 'secondary', () =>
          Alert.prompt('Причина отмены', '', (reason) => {
            if (reason) doAction(
              () => changeOrderStatus(idStr, 'cancelled'),
              'Заказ отменён'
            );
          })
        )}
      </View>
    );
  }

  // Designer
  if (role === 'designer') {
    return (
      <View style={styles.actionsBox}>
        {a.can_add_measurement && btn('Добавить замер', 'primary', () =>
          router.push({ pathname: '/orders/measurement-new', params: { orderId: idStr } })
        )}
        {a.can_take_in_work && statusBtn('Взять в работу', 'in_work', 'secondary')}
      </View>
    );
  }

  // Warehouse
  if (role === 'warehouse') {
    return (
      <View style={styles.actionsBox}>
        {btn('Материалы не готовы', 'secondary', () =>
          doAction(() => changeMaterialReadiness(idStr, 'not_ready'), 'Материалы: не готовы')
        )}
        {btn('Материалы частично готовы', 'secondary', () =>
          doAction(() => changeMaterialReadiness(idStr, 'partially_ready'), 'Материалы: частично готовы')
        )}
        {btn('Материалы готовы ✓', 'primary', () =>
          doAction(() => changeMaterialReadiness(idStr, 'ready'), 'Материалы: готовы')
        )}
      </View>
    );
  }

  // Production / Seamstress
  if (role === 'production') {
    return (
      <View style={styles.actionsBox}>
        {a.can_start_cutting && btn('Начать раскрой', 'secondary', () =>
          doAction(() => changeProductionStage(idStr, 'cutting'), 'Этап: раскрой')
        )}
        {a.can_start_sewing && btn('Начать пошив', 'primary', () =>
          doAction(() => changeProductionStage(idStr, 'sewing'), 'Этап: пошив')
        )}
        {a.can_mark_production_done && btn('Пошив завершён ✓', 'primary', () =>
          doAction(() => changeProductionStage(idStr, 'done'), 'Производство завершено')
        )}
      </View>
    );
  }

  // Installer
  if (role === 'installation') {
    return (
      <View style={styles.actionsBox}>
        {a.can_schedule_installation && btn('Назначить установку', 'secondary', () =>
          doAction(() => changeHandoverStage(idStr, 'installation_scheduled'), 'Установка назначена')
        )}
        {a.can_mark_installed && btn('Установка выполнена ✓', 'primary', () =>
          doAction(() => changeHandoverStage(idStr, 'installed'), 'Установка выполнена')
        )}
        {a.can_upload_photo && btn('Загрузить фотоотчёт', 'secondary', () =>
          Alert.alert('Скоро', 'Загрузка фото — следующий этап разработки')
        )}
        {btn('Выдача без установки', 'secondary', () =>
          doAction(() => changeHandoverStage(idStr, 'issued'), 'Выдача выполнена')
        )}
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8f9fa' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.base },
  errorText: { fontSize: typography.sizes.base, color: '#e53935', textAlign: 'center' },
  retryText: { fontSize: typography.sizes.base, color: colors.primary[500], textDecorationLine: 'underline' },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  back: { fontSize: typography.sizes.base, color: colors.primary[500] },
  orderNum: { fontSize: typography.sizes.lg, fontWeight: '500', color: colors.text, flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.base, paddingBottom: 60 },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: spacing.base,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '500',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  clientName: { fontSize: typography.sizes.xl, fontWeight: '500', color: colors.text, marginBottom: 2 },
  clientPhone: { fontSize: typography.sizes.base, color: colors.textMuted, marginBottom: 2 },
  clientMeta: { fontSize: typography.sizes.sm, color: colors.textMuted },
  divider: { height: 0.5, backgroundColor: '#e2e8f0', marginVertical: spacing.sm },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  infoLabel: { fontSize: typography.sizes.base, color: colors.textMuted },
  infoValue: { fontSize: typography.sizes.base, color: colors.text, fontWeight: '400' },
  infoAccent: { color: colors.primary[500], fontWeight: '500' },
  measureItem: { paddingVertical: spacing.sm },
  measureBorder: { borderTopWidth: 0.5, borderTopColor: '#f0f0f0' },
  measureRoom: { fontSize: typography.sizes.base, fontWeight: '500', color: colors.text, marginBottom: 2 },
  measureMeta: { fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: 1 },
  blockerRow: {
    backgroundColor: '#fff3f3',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  blockerText: { fontSize: typography.sizes.sm, color: '#dc2626' },
  warningsBox: {
    backgroundColor: '#fffbeb',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  warningText: { fontSize: typography.sizes.sm, color: '#92400e', marginBottom: 2 },
  actionsBox: { paddingVertical: spacing.sm, gap: spacing.sm },
  actionItem: { marginBottom: spacing.sm },
});

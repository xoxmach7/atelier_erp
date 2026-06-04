import { View, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { PrimaryButton } from '../PrimaryButton';
import {
  changeOrderStatus,
  changeMaterialReadiness,
  changeProductionStage,
  changeHandoverStage,
  type OrderExecution,
} from '../../api/orders';
import { spacing } from '../../theme/spacing';

export function OrderRoleActions({
  idStr,
  data,
  role,
  doAction,
}: {
  idStr: string;
  data: OrderExecution;
  role: string;
  doAction: (fn: () => Promise<unknown>, msg: string) => Promise<void>;
}) {
  const router = useRouter();
  const a = data.actions ?? {};

  const btn = (title: string, variant: 'primary' | 'secondary', fn: () => void) => (
    <View key={title} style={{ marginBottom: spacing.sm }}>
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
      <View style={{ paddingVertical: spacing.sm, gap: spacing.sm }}>
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
      <View style={{ paddingVertical: spacing.sm, gap: spacing.sm }}>
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
      <View style={{ paddingVertical: spacing.sm, gap: spacing.sm }}>
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
      <View style={{ paddingVertical: spacing.sm, gap: spacing.sm }}>
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
      <View style={{ paddingVertical: spacing.sm, gap: spacing.sm }}>
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

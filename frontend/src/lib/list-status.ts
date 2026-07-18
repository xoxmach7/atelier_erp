/**
 * Укрупнённый («списочный») статус заказа — единый источник правды.
 * Используется и в списке «Управление заказами», и в карточке заказа («Информация» → Статус).
 * Детальный статус (Готов, В производстве и т.д.) виден отдельно — в истории и блоке роли.
 */

export type ListStatusKey = "active" | "waiting" | "overdue" | "done";

/**
 * Раскладка должна совпадать с бэкендом (atelier_erp/api/v1/filters.py,
 * ORDER_STATUS_GROUPS) и с мобилкой (mobile/src/utils/orderLabels.ts).
 *
 * `isOverdue` передаётся отдельным аргументом, потому что "overdue" — не
 * значение Order.status, а производный флаг `is_overdue` с бэка. Раньше здесь
 * стояло сравнение `status === "overdue"`, которое не срабатывало никогда:
 * пилюля «Просрочено» всегда показывала 0, а просроченные заказы висели в
 * «В работе».
 */
export function getListStatus(status: string, isOverdue = false): ListStatusKey {
  if (["completed", "cancelled"].includes(status)) return "done";
  // Просрочка перебивает стадию, но только у незакрытых заказов.
  if (isOverdue) return "overdue";
  if (["waiting_final_payment", "draft", "new"].includes(status)) return "waiting";
  return "active";
}

export const LIST_STATUS_DISPLAY: Record<ListStatusKey, { label: string; color: string }> = {
  active:  { label: "В работе",   color: "#32ED51" },
  waiting: { label: "Ожидание",   color: "#EBDD1D" },
  overdue: { label: "Просрочено", color: "#DC2626" },
  done:    { label: "Завершён",   color: "#8D8D8D" },
};

/** Подпись + цвет укрупнённого статуса по сырому статусу заказа. */
export function getCoarseStatus(status: string, isOverdue = false): { label: string; color: string } {
  return LIST_STATUS_DISPLAY[getListStatus(status, isOverdue)];
}

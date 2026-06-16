/**
 * Укрупнённый («списочный») статус заказа — единый источник правды.
 * Используется и в списке «Управление заказами», и в карточке заказа («Информация» → Статус).
 * Детальный статус (Готов, В производстве и т.д.) виден отдельно — в истории и блоке роли.
 */

export type ListStatusKey = "active" | "waiting" | "overdue" | "done";

export function getListStatus(status: string): ListStatusKey {
  if (status === "overdue") return "overdue";
  if (["completed", "cancelled"].includes(status)) return "done";
  if (["waiting_final_payment", "draft", "new"].includes(status)) return "waiting";
  return "active";
}

export const LIST_STATUS_DISPLAY: Record<ListStatusKey, { label: string; color: string }> = {
  active:  { label: "В работе",   color: "#32ED51" },
  waiting: { label: "Ожидание",   color: "#EBDD1D" },
  overdue: { label: "Просрочено", color: "#DC2626" },
  done:    { label: "Завершён",   color: "#D3D3D3" },
};

/** Подпись + цвет укрупнённого статуса по сырому статусу заказа. */
export function getCoarseStatus(status: string): { label: string; color: string } {
  return LIST_STATUS_DISPLAY[getListStatus(status)];
}

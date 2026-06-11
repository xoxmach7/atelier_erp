/**
 * Канонические цвета и лейблы статусов — единый источник правды.
 * Используется в status-text.tsx, workspace/page.tsx и любом другом месте.
 */

export const STATUS_HEX: Record<string, string> = {
  overdue:               "#DC2626",
  new:                   "#0EA5E9",
  in_work:               "#32ED51",
  in_production:         "#7C3AED",
  ready:                 "#32ED51",
  on_installation:       "#4F46E5",
  waiting_final_payment: "#EBDD1D",
  completed:             "#94A3B8",
  cancelled:             "#DC2626",
  draft:                 "#94A3B8",
  measurement_scheduled: "#0EA5E9",
  measurement_done:      "#0EA5E9",
  pending:               "#EBDD1D",
  partial:               "#EBDD1D",
  paid:                  "#32ED51",
};

export const STATUS_LABELS: Record<string, string> = {
  overdue:               "Просрочено",
  new:                   "Новый",
  in_work:               "В работе",
  in_production:         "В производстве",
  ready:                 "Готов",
  on_installation:       "Установка",
  waiting_final_payment: "Ожидание",
  completed:             "Завершен",
  cancelled:             "Отменён",
  draft:                 "Черновик",
  measurement_scheduled: "Замер назначен",
  measurement_done:      "Замер выполнен",
  pending:               "Ожидание",
  partial:               "Частично",
  paid:                  "Оплачен",
};

/** Возвращает hex-цвет статуса (fallback: серый). */
export function getStatusHex(status: string): string {
  return STATUS_HEX[status] ?? "#94A3B8";
}

/** Возвращает русскоязычный лейбл статуса. */
export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}

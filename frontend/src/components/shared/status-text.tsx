import { cn } from "@/lib/utils";

/**
 * Цвета статусов — по Figma:
 *   Просрочено:       #DC2626 (красный)
 *   В работе / Готов: #32ED51 (ярко-зелёный)
 *   Ожидание:         #EBDD1D (жёлтый)
 *   Завершен:         #94A3B8 (серый)
 *   Отменён:          #DC2626 (красный)
 *   Новый:            #0EA5E9 (голубой)
 *   В производстве:   #7C3AED (фиолетовый)
 *   Установка:        #4F46E5 (синий)
 */

const statusColors: Record<string, string> = {
  overdue:                "text-[#DC2626]",
  new:                    "text-[#0EA5E9]",
  in_work:                "text-[#32ED51]",
  in_production:          "text-[#7C3AED]",
  ready:                  "text-[#32ED51]",
  on_installation:        "text-[#4F46E5]",
  waiting_final_payment:  "text-[#EBDD1D]",
  completed:              "text-[#94A3B8]",
  cancelled:              "text-[#DC2626]",
  draft:                  "text-[#94A3B8]",
  measurement_scheduled:  "text-[#0EA5E9]",
  measurement_done:       "text-[#0EA5E9]",
  pending:                "text-[#EBDD1D]",
  partial:                "text-[#EBDD1D]",
  paid:                   "text-[#32ED51]",
};

const statusLabels: Record<string, string> = {
  overdue:                "Просрочено",
  new:                    "Новый",
  in_work:                "В работе",
  in_production:          "В производстве",
  ready:                  "Готов",
  on_installation:        "Установка",
  waiting_final_payment:  "Ожидание",
  completed:              "Завершен",
  cancelled:              "Отменён",
  draft:                  "Черновик",
  measurement_scheduled:  "Замер назначен",
  measurement_done:       "Замер выполнен",
  pending:                "Ожидание",
  partial:                "Частично",
  paid:                   "Оплачен",
};

interface StatusTextProps {
  status: string;
  className?: string;
}

/**
 * StatusText — цветной текст статуса (без фона/badge).
 * Как в Figma: TT Norms Pro, 500, цветной текст.
 */
export function StatusText({ status, className }: StatusTextProps) {
  const colorClass = statusColors[status] || "text-[#94A3B8]";
  const label = statusLabels[status] || status.replaceAll("_", " ");

  return (
    <span className={cn("font-medium", colorClass, className)}>
      {label}
    </span>
  );
}

import { cn } from "@/lib/utils";

/**
 * Цвета статусов по Figma:
 *   Просрочено / Отменён  #DC2626 (красный)
 *   В работе / Готов      #32ED51 (зелёный)
 *   Ожидание оплаты       #EBDD1D (жёлтый)
 *   Завершён / Черновик   #94A3B8 (серый)
 *   Новый                 #0EA5E9 (голубой)
 *  *   Установка             #4F46E5 (синий)
 */

const statusColors: Record<string, string> = {
  new:                    "text-[#0EA5E9]",
  in_work:                "text-[#32ED51]",
  ready:                  "text-[#32ED51]",
  on_installation:        "text-[#4F46E5]",
  waiting_final_payment:  "text-[#EBDD1D]",
  completed:              "text-[#94A3B8]",
  cancelled:              "text-[#DC2626]",
  draft:                  "text-[#94A3B8]",
  overdue:                "text-[#DC2626]",
};

const statusLabels: Record<string, string> = {
  new:                    "Новый",
  in_work:                "В работе",
  ready:                  "Готов",
  on_installation:        "Установка",
  waiting_final_payment:  "Ожидание оплаты",
  completed:              "Завершён",
  cancelled:              "Отменён",
  draft:                  "Черновик",
  overdue:                "Просрочено",
};

interface StatusTextProps {
  status: string;
  className?: string;
}

export function StatusText({ status, className }: StatusTextProps) {
  const colorClass = statusColors[status] ?? "text-[#94A3B8]";
  const label = statusLabels[status] ?? status.replaceAll("_", " ");
  return (
    <span className={cn("font-medium", colorClass, className)}>
      {label}
    </span>
  );
}

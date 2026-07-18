import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type {
  MaterialReadiness,
  OrderStatus,
  PaymentStatus,
  ProductionStatus,
  TaskStatus,
} from "@/types";

type StatusType = OrderStatus | TaskStatus | ProductionStatus | PaymentStatus | string;

interface StatusBadgeProps {
  status: StatusType;
  /**
   * Готовая подпись с бэкенда (`status_label`). Если передана — имеет приоритет
   * над локальным словарём: бэкенд единственный источник истины для текста
   * статуса. Локальный словарь остаётся fallback'ом, когда label не передан.
   */
  label?: string;
  className?: string;
}

interface MaterialReadinessBadgeProps {
  readiness: MaterialReadiness | string;
  className?: string;
}

const statusStyles: Record<string, string> = {
  new: "bg-sky-100 text-sky-700",
  in_work: "bg-blue-100 text-blue-700",
  in_production: "bg-violet-100 text-violet-700",
  ready: "bg-green-100 text-green-700",
  on_installation: "bg-indigo-100 text-indigo-700",
  waiting_final_payment: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
  draft: "bg-slate-100 text-slate-700",
  measurement_scheduled: "bg-blue-100 text-blue-700",
  measurement_done: "bg-cyan-100 text-cyan-700",
  quoted: "bg-purple-100 text-purple-700",
  confirmed: "bg-indigo-100 text-indigo-700",
  ready_for_installation: "bg-orange-100 text-orange-700",
  installing: "bg-yellow-100 text-yellow-700",
  lead: "bg-slate-100 text-slate-700",
  quoting: "bg-purple-100 text-purple-700",
  quote_sent: "bg-indigo-100 text-indigo-700",
  converted: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
  postponed: "bg-amber-100 text-amber-700",
  pending: "bg-slate-100 text-slate-700",
  cutting: "bg-blue-100 text-blue-700",
  sewing: "bg-violet-100 text-violet-700",
  finishing: "bg-amber-100 text-amber-700",
  quality_check: "bg-orange-100 text-orange-700",
  production_ready: "bg-green-100 text-green-700",
  partial: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
};

const statusLabels: Record<string, string> = {
  // Должно совпадать с Order.Status на бэкенде (единый источник истины) и с
  // mobile/src/utils/orderLabels.ts. Расхождение подписей = разный текст на
  // вебе и в мобилке для одного и того же заказа.
  new: "Новый",
  in_work: "В работе",
  in_production: "В производстве",
  ready: "Готов",
  on_installation: "На установке / выдаче",
  waiting_final_payment: "Ожидает финальной оплаты",
  completed: "Завершён",
  cancelled: "Отменён",
  draft: "Черновик",
  measurement_scheduled: "Замер назначен",
  measurement_done: "Замер выполнен",
  quoted: "КП отправлено",
  confirmed: "Подтверждён",
  ready_for_installation: "Готов к монтажу",
  installing: "Монтаж",
  lead: "Лид",
  quoting: "Смета",
  quote_sent: "КП отправлено",
  converted: "Конвертирован",
  lost: "Потерян",
  postponed: "Отложен",
  pending: "Ожидание",
  cutting: "Раскрой",
  sewing: "Пошив",
  finishing: "Отделка",
  quality_check: "Контроль качества",
  production_ready: "Готов к производству",
  partial: "Частично",
  paid: "Оплачен",
};

const readinessStyles: Record<string, string> = {
  not_ready: "bg-red-100 text-red-700",
  partially_ready: "bg-amber-100 text-amber-700",
  ready: "bg-green-100 text-green-700",
};

const readinessLabels: Record<string, string> = {
  not_ready: "Не обеспечен",
  partially_ready: "Частично обеспечен",
  ready: "Материалы готовы",
};

function humanizeStatus(status: string): string {
  return statusLabels[status] || status.replaceAll("_", " ");
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const style = statusStyles[status] || "bg-slate-100 text-slate-700";

  return (
    <Badge variant="secondary" className={cn(style, className)}>
      {label || humanizeStatus(status)}
    </Badge>
  );
}

export function MaterialReadinessBadge({ readiness, className }: MaterialReadinessBadgeProps) {
  const style = readinessStyles[readiness] || "bg-slate-100 text-slate-700";
  const label = readinessLabels[readiness] || readiness;

  return (
    <Badge variant="secondary" className={cn(style, className)}>
      {label}
    </Badge>
  );
}

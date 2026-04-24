/**
 * TEMPORARY SHARED STATUS BADGE
 * 
 * This is a temporary shared implementation combining all domain statuses.
 * TODO Sprint 2+: Split into domain-specific components:
 *   - OrderStatusBadge (orders domain)
 *   - TaskStatusBadge (tasks/leads domain)
 *   - ProductionStatusBadge (production domain)
 *   - PaymentStatusBadge (payments domain)
 */

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { OrderStatus, TaskStatus, ProductionStatus, PaymentStatus } from "@/types";

type StatusType = OrderStatus | TaskStatus | ProductionStatus | PaymentStatus;

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusStyles: Record<string, string> = {
  // Order statuses
  draft: "bg-slate-100 text-slate-700",
  measurement_scheduled: "bg-blue-100 text-blue-700",
  measurement_done: "bg-cyan-100 text-cyan-700",
  quoted: "bg-purple-100 text-purple-700",
  confirmed: "bg-indigo-100 text-indigo-700",
  in_production: "bg-amber-100 text-amber-700",
  ready_for_installation: "bg-orange-100 text-orange-700",
  installing: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  
  // Task statuses
  lead: "bg-slate-100 text-slate-700",
  quoting: "bg-purple-100 text-purple-700",
  quote_sent: "bg-indigo-100 text-indigo-700",
  converted: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
  postponed: "bg-amber-100 text-amber-700",
  
  // Production statuses
  pending: "bg-slate-100 text-slate-700",
  cutting: "bg-blue-100 text-blue-700",
  sewing: "bg-purple-100 text-purple-700",
  finishing: "bg-amber-100 text-amber-700",
  quality_check: "bg-orange-100 text-orange-700",
  ready: "bg-green-100 text-green-700",
  
  // Payment statuses
  partial: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
};

const statusTranslations: Record<string, string> = {
  // Order statuses
  draft: "Черновик",
  measurement_scheduled: "Замер назначен",
  measurement_done: "Замер выполнен",
  quoted: "КП отправлено",
  confirmed: "Подтвержден",
  in_production: "В производстве",
  ready_for_installation: "Готов к монтажу",
  installing: "Монтаж",
  completed: "Выполнен",
  cancelled: "Отменен",
  // Task statuses
  lead: "Лид",
  quoting: "Смета",
  quote_sent: "КП отправлено",
  converted: "Конвертирован",
  lost: "Потерян",
  postponed: "Отложен",
  // Production statuses
  pending: "Ожидание",
  cutting: "Раскрой",
  sewing: "Пошив",
  finishing: "Отделка",
  quality_check: "Контроль качества",
  ready: "Готов",
  // Payment statuses
  partial: "Частично",
  paid: "Оплачен",
};

const formatStatus = (status: string): string => {
  return statusTranslations[status] || status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = statusStyles[status] || "bg-slate-100 text-slate-700";
  
  return (
    <Badge variant="secondary" className={cn(style, className)}>
      {formatStatus(status)}
    </Badge>
  );
}

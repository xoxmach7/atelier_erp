"use client";

import Link from "next/link";
import {
  Ruler,
  FileText,
  Package,
  CheckCircle2,
  Scissors,
  Truck,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRole, type WebRole } from "@/hooks/useRole";
import type { OrderDetailDTO, OrderExecutionDTO } from "@/types";

/* ------------------------------------------------------------------ */
/*  Task Definition                                                     */
/* ------------------------------------------------------------------ */

interface TaskInfo {
  title: string;
  desc: string;
  action?: string;
  actionIcon?: React.ReactNode;
  actionHref?: string;
  onAction?: () => void;
  done?: boolean;
  waiting?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Task Logic Per Role                                                 */
/* ------------------------------------------------------------------ */

function getDesignerTask(
  order: OrderDetailDTO,
  onOpenMeasurement?: () => void,
  onOpenKP?: () => void
): TaskInfo {
  const hasMeasurements = (order.measurements?.length ?? 0) > 0;
  const hasQuote =
    order.source_quote != null ||
    (order.related_quotes && order.related_quotes.length > 0);

  if (!hasMeasurements) {
    return {
      title: "Добавить замер",
      desc: "Выехать на замер, добавить позиции и выбрать ткань",
      action: "Добавить замер",
      actionIcon: <Ruler size={14} />,
      actionHref: `/measurements?order=${order.id}`,
      onAction: onOpenMeasurement,
    };
  }

  if (!hasQuote && ["new", "in_work"].includes(order.status)) {
    return {
      title: "Подготовить КП",
      desc: "Замер есть — создайте коммерческое предложение для клиента",
      action: "Создать КП",
      actionIcon: <FileText size={14} />,
      actionHref: `/estimate?order=${order.id}`,
      onAction: onOpenKP,
    };
  }

  return {
    title: "Задача выполнена",
    desc: "Замер и КП готовы",
    done: true,
  };
}

function getWarehouseTask(order: OrderDetailDTO): TaskInfo {
  if (order.material_readiness === "not_ready") {
    return {
      title: "Обеспечить материалы",
      desc: "Закупить и подготовить все материалы для заказа",
      action: "Начать закупку",
      actionIcon: <Package size={14} />,
    };
  }
  if (order.material_readiness === "partially_ready") {
    return {
      title: "Материалы частично готовы",
      desc: "Часть материалов в закупке — проверьте и обновите",
      action: "Обновить",
      actionIcon: <CheckCircle2 size={14} />,
    };
  }
  return {
    title: "Материалы готовы",
    desc: "Все материалы обеспечены",
    done: true,
  };
}

function getProductionTask(
  order: OrderDetailDTO,
  execution?: OrderExecutionDTO
): TaskInfo {
  const stage = execution?.production_stage || "not_started";

  if (stage === "not_started") {
    return {
      title: "Начать пошив",
      desc: "Материалы готовы — можно приступать к пошиву",
      action: "Начать",
      actionIcon: <Scissors size={14} />,
    };
  }
  if (stage !== "done") {
    return {
      title: "Изделия в пошиве",
      desc: "Завершите пошив и отметьте готовность",
      action: "Отметить готово",
      actionIcon: <CheckCircle2 size={14} />,
    };
  }
  return {
    title: "Пошив завершён",
    desc: "Все изделия пошиты и готовы к передаче",
    done: true,
  };
}

function getInstallerTask(order: OrderDetailDTO): TaskInfo {
  if (
    ["completed", "waiting_final_payment"].includes(order.status)
  ) {
    return {
      title: "Установка завершена",
      desc: "Работа по этому заказу выполнена",
      done: true,
    };
  }
  if (order.status === "on_installation") {
    return {
      title: "Завершить установку",
      desc: "Загрузите фото результата и АВР",
      action: "Загрузить фото",
      actionIcon: <Camera size={14} />,
      actionHref: `/orders/${order.id}/photos`,
    };
  }
  if (order.status === "ready") {
    const address = [
      order.installation_address_city,
      order.installation_address_street,
      order.installation_address_building &&
        `д. ${order.installation_address_building}`,
      order.installation_address_apartment &&
        `кв. ${order.installation_address_apartment}`,
    ]
      .filter(Boolean)
      .join(", ");
    return {
      title: "Выехать на установку",
      desc: address ? `Адрес: ${address}` : "Адрес не указан",
      action: "Начать установку",
      actionIcon: <Truck size={14} />,
    };
  }
  return {
    title: "Ожидание",
    desc: "Заказ ещё не готов к установке",
    waiting: true,
  };
}

/* ------------------------------------------------------------------ */
/*  Role → Icon mapping                                                 */
/* ------------------------------------------------------------------ */

const ROLE_ICONS: Record<string, React.ReactNode> = {
  designer: <Ruler size={20} />,
  warehouse: <Package size={20} />,
  production: <Scissors size={20} />,
  installation: <Truck size={20} />,
};

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

interface MyTaskCardProps {
  order: OrderDetailDTO;
  execution?: OrderExecutionDTO;
  /** Called to open the measurement creation modal */
  onOpenMeasurement?: () => void;
  /** Called to open the KP creation modal */
  onOpenKP?: () => void;
}

export function MyTaskCard({
  order,
  execution,
  onOpenMeasurement,
  onOpenKP,
}: MyTaskCardProps) {
  const { role, isOwner } = useRole();

  // Don't show for owner/admin
  if (isOwner || role === "none") return null;

  let task: TaskInfo;
  switch (role) {
    case "designer":
      task = getDesignerTask(order, onOpenMeasurement, onOpenKP);
      break;
    case "warehouse":
      task = getWarehouseTask(order);
      break;
    case "production":
      task = getProductionTask(order, execution);
      break;
    case "installation":
      task = getInstallerTask(order);
      break;
    default:
      return null;
  }

  const accentColor = "var(--a)";
  const icon = ROLE_ICONS[role] || <Ruler size={20} />;

  return (
    <div
      className={`
        rounded-xl border-l-4 p-5 mb-4
        ${task.done ? "border-l-[#16A34A] bg-[#DCFCE7]/60" : ""}
        ${task.waiting ? "border-l-[#D97706] bg-[#FEF3C7]/40" : ""}
        ${!task.done && !task.waiting ? "border-l-[var(--a)] bg-white shadow-sm" : ""}
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div
            className={`
              w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0
              ${task.done ? "bg-[#16A34A]/15 text-[#16A34A]" : "bg-[var(--a)]/12 text-[var(--a)]"}
            `}
          >
            {task.done ? <CheckCircle2 size={20} /> : icon}
          </div>
          {/* Text */}
          <div>
            <div
              className="text-[11px] font-bold uppercase tracking-wide mb-0.5"
              style={{ color: accentColor }}
            >
              Моя задача
            </div>
            <div className="text-[15px] font-semibold text-[var(--t1)]">
              {task.title}
            </div>
            <div className="text-[12px] text-[var(--t2)] mt-0.5">
              {task.desc}
            </div>
          </div>
        </div>

        {/* Action button */}
        {task.action && (
          <>
            {task.onAction ? (
              <Button
                onClick={task.onAction}
                className="bg-[var(--a)] hover:bg-[var(--ad)] text-white shrink-0 gap-2"
              >
                {task.actionIcon}
                {task.action}
              </Button>
            ) : task.actionHref ? (
              <Button
                asChild
                className="bg-[var(--a)] hover:bg-[var(--ad)] text-white shrink-0 gap-2"
              >
                <Link href={task.actionHref}>
                  {task.actionIcon}
                  {task.action}
                </Link>
              </Button>
            ) : (
              <Button
                className="bg-[var(--a)] hover:bg-[var(--ad)] text-white shrink-0 gap-2"
              >
                {task.actionIcon}
                {task.action}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

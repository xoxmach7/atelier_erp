"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronUp, ArrowLeft, Info, Clock } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { StatusText } from "@/components/shared/status-text";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  useOrder,
  useOrderExecution,
  useChangeOrderStatus,
  useChangeMaterialReadiness,
  useChangeProductionStage,
  useChangeHandoverStage,
  useCancelOrder,
} from "@/hooks/useOrders";
import { useRole } from "@/hooks/useRole";
import type {
  OrderDetailDTO,
  OrderItemDTO,
  OrderExecutionDTO,
  AvailableActionDTO,
  OrderStatus,
} from "@/types";

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtCurrency(v: string | number | null | undefined): string {
  const n = typeof v === "string" ? parseFloat(v) : (v ?? 0);
  if (!n || isNaN(n)) return "—";
  return n.toLocaleString("ru-RU") + " ₸";
}

function getCustomerName(order: OrderDetailDTO): string {
  if (typeof order.customer === "object" && order.customer)
    return order.customer.full_name || "—";
  return "—";
}

function getCustomerPhone(order: OrderDetailDTO): string {
  if (typeof order.customer === "object" && order.customer)
    return order.customer.phone || "";
  return "";
}

function getDesignerName(order: OrderDetailDTO): string {
  return (order as OrderDetailDTO & { designer_name?: string }).designer_name || "—";
}

function getAddressParts(order: OrderDetailDTO): string {
  const parts = [
    order.installation_address_city,
    order.installation_address_street,
    order.installation_address_building && `д. ${order.installation_address_building}`,
    order.installation_address_apartment && `кв. ${order.installation_address_apartment}`,
    order.installation_address_notes,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "—";
}

/* ------------------------------------------------------------------ */
/*  InfoCell                                                            */
/* ------------------------------------------------------------------ */

function InfoCell({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center text-center px-4 ${className}`}>
      <span className="text-[12px] text-[#94A3B8] mb-1">{label}</span>
      <span className="text-[14px] text-[#0F172A]">{children}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ItemRow (expandable)                                                */
/* ------------------------------------------------------------------ */

function ItemRow({ item }: { item: OrderItemDTO }) {
  const [open, setOpen] = useState(false);

  const roomLabel = [item.room_name, item.window_name].filter(Boolean).join(" / ");
  const price = item.total_price
    ? parseFloat(item.total_price).toLocaleString("ru-RU") + " ₸"
    : "—";

  return (
    <div className="border-b border-dashed border-[#E2E8F0] last:border-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3 px-1 text-left hover:bg-[#FAFBFC] transition-colors"
      >
        <div className="min-w-0">
          <div className="text-[14px] text-[#0F172A]">
            {roomLabel || item.item_type || "Позиция"}
          </div>
          {item.window_name && item.room_name && (
            <div className="text-[13px] text-[#94A3B8]">
              {item.window_name}{" "}
              {item.window_width_cm && item.window_height_cm
                ? `(${item.window_width_cm}×${item.window_height_cm})`
                : ""}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[14px] font-medium text-[#0F172A]">{price}</span>
          {open ? (
            <ChevronUp size={16} className="text-[#94A3B8]" />
          ) : (
            <ChevronDown size={16} className="text-[#94A3B8]" />
          )}
        </div>
      </button>

      {open && (
        <div className="px-1 pb-3 text-[13px] text-[#475569] space-y-1">
          {item.fabric_name && (
            <div>
              <span className="text-[#94A3B8]">Ткань:</span> {item.fabric_name}
              {item.sewing_type && ` (${item.sewing_type})`}
            </div>
          )}
          {item.notes && (
            <div>
              <span className="text-[#94A3B8]">Тюль:</span> {item.notes}
            </div>
          )}
          {item.folds_count && (
            <div>
              <span className="text-[#94A3B8]">Тип крепления:</span> {item.folds_count} складок
            </div>
          )}
          <div>
            <span className="text-[#94A3B8]">Количество:</span> {item.quantity}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  History Timeline                                                    */
/* ------------------------------------------------------------------ */

interface TimelineEvent {
  date: string;
  label: string;
  color: "green" | "gray" | "yellow" | "empty";
}

function buildTimeline(
  order: OrderDetailDTO,
  execution?: OrderExecutionDTO
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  const createdDate =
    order.created_at
      ? fmtDate(order.created_at) +
        " " +
        new Date(order.created_at).toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

  events.push({ date: createdDate, label: "Заказ создан", color: "gray" });

  if (
    order.source_quote ||
    (order.related_quotes && order.related_quotes.length > 0)
  ) {
    events.push({ date: "", label: "КП создано", color: "gray" });
  }

  if (order.payments && order.payments.length > 0) {
    order.payments.forEach((p) => {
      events.push({
        date: fmtDate(p.received_at || p.created_at),
        label:
          p.payment_type === "prepayment"
            ? "Предоплата внесена"
            : p.payment_type === "final"
            ? "Финальная оплата"
            : "Платёж записан",
        color: "gray",
      });
    });
  }

  if (order.material_readiness === "ready") {
    events.push({ date: "", label: "Материалы собраны", color: "gray" });
  }

  const prodStage = execution?.production_stage;
  if (prodStage && prodStage !== "not_started") {
    events.push({
      date: "",
      label: prodStage === "done" ? "Изделия готовы" : "Изделия в производстве",
      color: prodStage === "done" ? "gray" : "green",
    });
  }

  const handover = execution?.handover_stage;
  if (handover === "done") {
    events.push({ date: "", label: "Изделия установлены", color: "gray" });
  } else if (handover === "in_progress" || handover === "scheduled") {
    events.push({ date: "", label: "Установка запланирована", color: "yellow" });
  } else {
    events.push({ date: "", label: "Изделия не установлены", color: "empty" });
  }

  if (order.status === "completed") {
    events.push({
      date: fmtDate(order.actual_completion),
      label: "Заказ завершён",
      color: "green",
    });
  }

  return events;
}

function TimelineDot({ color }: { color: TimelineEvent["color"] }) {
  const base = "w-[14px] h-[14px] rounded-full shrink-0 border-2";
  switch (color) {
    case "green":
      return <div className={`${base} bg-[#32ED51] border-[#32ED51]`} />;
    case "yellow":
      return <div className={`${base} bg-[#EBDD1D] border-[#EBDD1D]`} />;
    case "gray":
      return <div className={`${base} bg-[#94A3B8] border-[#94A3B8]`} />;
    case "empty":
      return <div className={`${base} bg-white border-[#CBD5E1]`} />;
  }
}

function HistoryTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="space-y-0">
      {events.map((ev, i) => (
        <div key={i} className="flex gap-3 relative">
          {i < events.length - 1 && (
            <div className="absolute left-[6px] top-[18px] bottom-[-4px] w-[2px] bg-[#E2E8F0]" />
          )}
          <div className="pt-[3px]">
            <TimelineDot color={ev.color} />
          </div>
          <div className="pb-5 min-w-0">
            {ev.date && (
              <div className="text-[11px] text-[#94A3B8] leading-tight">{ev.date}</div>
            )}
            <div className="text-[13px] text-[#0F172A] leading-snug">{ev.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Production Stage Modal                                              */
/* ------------------------------------------------------------------ */

const PRODUCTION_STAGES = [
  { value: "not_started", label: "Не начато" },
  { value: "cutting",     label: "Раскрой" },
  { value: "sewing",      label: "Пошив" },
  { value: "quality_check", label: "Контроль качества" },
  { value: "done",        label: "Производство завершено" },
];

function ProductionStageModal({
  isOpen,
  onClose,
  orderId,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  onSuccess: () => void;
}) {
  const [selected, setSelected] = useState("");
  const mutation = useChangeProductionStage();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    try {
      await mutation.mutateAsync({
        orderId,
        data: {
          production_stage: selected as
            | "not_started"
            | "cutting"
            | "sewing"
            | "quality_check"
            | "done",
        },
      });
      onSuccess();
    } catch {
      /* errors handled by mutation */
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Этап производства</DialogTitle>
          <DialogDescription>Выберите текущий этап</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-2 py-2">
          {PRODUCTION_STAGES.map((s) => (
            <label
              key={s.value}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selected === s.value
                  ? "border-[#0EA5E9] bg-[#E0F2FE]"
                  : "border-[#E2E8F0] hover:bg-[#F8FAFC]"
              }`}
            >
              <input
                type="radio"
                name="production_stage"
                value={s.value}
                checked={selected === s.value}
                onChange={(e) => setSelected(e.target.value)}
                className="accent-[#0EA5E9]"
              />
              <span className="text-[14px] text-[#0F172A]">{s.label}</span>
            </label>
          ))}
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={!selected || mutation.isPending}
              className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
            >
              {mutation.isPending ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Action button label helper                                          */
/* ------------------------------------------------------------------ */

function actionLabel(action: AvailableActionDTO): string {
  const labels: Record<string, string> = {
    change_status: "Сменить статус",
    change_material_readiness: "Материалы готовы",
    change_production_stage: "Этап производства",
    change_handover_stage: "Установка выполнена",
    transition_to_ready: "Перевести: Готов",
    transition_to_in_work: "Перевести: В работе",
    transition_to_in_production: "Перевести: В производство",
    transition_to_on_installation: "Перевести: На установку",
    transition_to_waiting_final_payment: "Перевести: Ожидание оплаты",
    transition_to_completed: "Завершить заказ",
    transition_to_new: "Вернуть: Новый",
  };
  return action.label || labels[action.action] || action.action;
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                           */
/* ------------------------------------------------------------------ */

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  const { role } = useRole();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [productionModalOpen, setProductionModalOpen] = useState(false);

  /* ---- guard against literal [id] placeholder in URL ---- */
  if (
    !orderId ||
    orderId === "[id]" ||
    orderId === "%5Bid%5D" ||
    (orderId.startsWith("[") && orderId.endsWith("]"))
  ) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-[#F0F4F8] p-8">
          <ErrorState
            title="Некорректный ID заказа"
            description={`Обнаружен неверный идентификатор: "${orderId}".`}
          />
          <Link href="/orders" className="text-[#0EA5E9] hover:underline text-sm mt-4 inline-block">
            ← Назад к заказам
          </Link>
        </div>
      </ProtectedRoute>
    );
  }

  const { data: order, isLoading, error } = useOrder(orderId);
  const {
    data: execution,
    refetch: refetchExecution,
  } = useOrderExecution(orderId);

  /* ---- mutations ---- */
  const changeStatusMutation      = useChangeOrderStatus();
  const changeMaterialMutation    = useChangeMaterialReadiness();
  const changeProductionMutation  = useChangeProductionStage();
  const changeHandoverMutation    = useChangeHandoverStage();
  const cancelMutation            = useCancelOrder();
  /* ---- action dispatcher ---- */
  const handleAction = async (action: AvailableActionDTO) => {
    setActionError(null);
    try {
      switch (action.action) {
        case "change_material_readiness":
          await changeMaterialMutation.mutateAsync({
            orderId,
            data: { material_readiness: "ready" },
          });
          break;
        case "change_production_stage":
          setProductionModalOpen(true);
          return;
        case "change_handover_stage":
          await changeHandoverMutation.mutateAsync({
            orderId,
            data: { handover_stage: "done" },
          });
          break;
        case "change_status":
          if (action.target_status) {
            await changeStatusMutation.mutateAsync({
              orderId,
              data: { status: action.target_status as OrderStatus },
            });
          }
          break;
        case "transition_to_ready":
          await changeStatusMutation.mutateAsync({ orderId, data: { status: "ready" } });
          break;
        case "transition_to_in_work":
          await changeStatusMutation.mutateAsync({ orderId, data: { status: "in_work" } });
          break;
        case "transition_to_in_production":
          await changeStatusMutation.mutateAsync({ orderId, data: { status: "in_production" } });
          break;
        case "transition_to_on_installation":
          await changeStatusMutation.mutateAsync({ orderId, data: { status: "on_installation" } });
          break;
        case "transition_to_waiting_final_payment":
          await changeStatusMutation.mutateAsync({
            orderId,
            data: { status: "waiting_final_payment" },
          });
          break;
        case "transition_to_completed":
          await changeStatusMutation.mutateAsync({ orderId, data: { status: "completed" } });
          break;
        case "transition_to_new":
          await changeStatusMutation.mutateAsync({ orderId, data: { status: "new" } });
          break;
        default:
          break;
      }
      await refetchExecution();
    } catch (err) {
      const e = err as { response?: { data?: { detail?: string; code?: string } } };
      const code = e.response?.data?.code || "";
      const detail = e.response?.data?.detail || "Произошла ошибка";
      const errorMessages: Record<string, string> = {
        material_not_ready: "Нельзя начать производство: материалы не обеспечены.",
        completed_order: "Нельзя изменить завершённый заказ.",
        already_cancelled: "Заказ уже отменён.",
        reason_required: "Необходимо указать причину.",
        production_not_done: "Производство ещё не завершено.",
        payment_required: "Требуется оплата перед завершением.",
        cancelled_order: "Нельзя изменить отменённый заказ.",
      };
      setActionError(errorMessages[code] || detail);
    }
  };

  /* ---- cancel with reason ---- */
  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      setActionError("Укажите причину отмены");
      return;
    }
    setActionError(null);
    try {
      await cancelMutation.mutateAsync({ orderId, data: { reason: cancelReason } });
      setShowDeleteConfirm(false);
      setCancelReason("");
      router.push("/orders");
    } catch (err) {
      const e = err as { response?: { data?: { detail?: string } } };
      setActionError(e.response?.data?.detail || "Не удалось отменить заказ");
    }
  };

  /* ---- loading / error states ---- */
  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-[#F0F4F8] flex items-center justify-center">
          <LoadingState message="Загрузка заказа..." />
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !order) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-[#F0F4F8] p-8">
          <ErrorState
            title="Ошибка загрузки заказа"
            description={error?.message || "Заказ не найден"}
          />
          <Link href="/orders" className="text-[#0EA5E9] hover:underline text-sm mt-4 inline-block">
            ← Назад к заказам
          </Link>
        </div>
      </ProtectedRoute>
    );
  }

  const items = order.items ?? [];
  const total = parseFloat(order.total_amount || "0");
  const paid = parseFloat(order.paid_amount || "0");
  const prepayPercent = total > 0 ? Math.round((paid / total) * 100) : 0;
  const timeline = buildTimeline(order, execution);
  const availableActions = execution?.available_actions ?? [];
  const isOwnerOrDesigner = role === "owner" || role === "designer";

  /* ---- role-filtered quick links ---- */
  type QuickLink = { href: string; label: string; roles?: string[] };
  const quickLinks: QuickLink[] = [
    { href: `/measurements?order=${order.id}`,  label: "Замеры",     roles: ["owner", "designer"] },
    { href: `/estimate?order=${order.id}`,       label: "КП",         roles: ["owner", "designer"] },
    { href: `/orders/${orderId}/materials`,      label: "Материалы",  roles: ["owner", "designer", "warehouse"] },
    { href: `/orders/${orderId}/photos`,         label: "Фотоотчёт",  roles: ["owner", "designer", "installation"] },
    { href: `/orders/${orderId}/act`,            label: "АВР",        roles: ["owner", "designer", "installation"] },
    { href: `/payments?order=${order.id}`,       label: "Платежи",    roles: ["owner", "designer"] },
  ].filter((l) => !l.roles || l.roles.includes(role ?? ""));

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#F0F4F8] p-6">
        <div className="bg-white rounded-xl shadow-sm">

          {/* ── Header ──────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-[52px] py-[30px]">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/orders")}
                className="rounded-lg border border-[#E2E8F0] p-[7px] text-[#475569] hover:text-[#0EA5E9] transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
              <h1 className="text-[26px] font-semibold text-[#0F172A]">
                Заказ №{order.order_number || orderId.slice(0, 6)}
              </h1>
            </div>
            {isOwnerOrDesigner && (
              <div className="flex items-center gap-8">
                <Link
                  href={`/orders/${orderId}/edit`}
                  className="text-[15px] text-[#475569] hover:text-[#0EA5E9] transition-colors"
                >
                  Редактировать информацию
                </Link>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-[15px] text-[#475569] hover:text-[#DC2626] transition-colors"
                >
                  Удалить заказ
                </button>
              </div>
            )}
          </div>

          {/* ── Info grid ───────────────────────────────────────── */}
          <div className="px-[52px] pb-8">
            <div className="rounded-xl border border-[#E2E8F0] p-6">
              <div className="flex items-center justify-center gap-2 mb-5">
                <Info size={16} className="text-[#94A3B8]" />
                <span className="text-[15px] font-medium text-[#0F172A]">Информация</span>
              </div>
              <div className="flex items-start justify-between divide-x divide-[#F1F5F9]">
                <InfoCell label="Клиент">
                  <div className="font-medium">{getCustomerName(order)}</div>
                  {getCustomerPhone(order) && (
                    <div className="text-[12px] text-[#94A3B8]">{getCustomerPhone(order)}</div>
                  )}
                </InfoCell>
                <InfoCell label="Создан">{fmtDate(order.created_at)}</InfoCell>
                <InfoCell label="Дизайнер">{getDesignerName(order)}</InfoCell>
                <InfoCell label="Статус">
                  <StatusText status={order.status} />
                </InfoCell>
                <InfoCell label="Дата замера">{fmtDate(order.measurement_date)}</InfoCell>
                <InfoCell label="Завершение">{fmtDate(order.planned_completion)}</InfoCell>
                <InfoCell label="Адрес установки" className="max-w-[200px]">
                  <span className="text-[13px] leading-snug">{getAddressParts(order)}</span>
                </InfoCell>
              </div>
            </div>
          </div>

          {/* ── Action error ─────────────────────────────────────── */}
          {actionError && (
            <div className="px-[52px] pb-4">
              <div className="rounded-lg bg-[#FEE2E2] border border-[#FECACA] px-4 py-3 text-[13px] text-[#DC2626]">
                {actionError}
              </div>
            </div>
          )}

          {/* ── Available actions ────────────────────────────────── */}
          {availableActions.length > 0 && (
            <div className="px-[52px] pb-6">
              <div className="flex flex-wrap gap-3">
                {availableActions.map((action, i) => (
                  <button
                    key={i}
                    onClick={() => handleAction(action)}
                    disabled={
                      changeStatusMutation.isPending ||
                      changeMaterialMutation.isPending ||
                      changeHandoverMutation.isPending
                    }
                    className="px-5 py-2 rounded-lg bg-[#0EA5E9] text-white text-[13px] font-medium hover:bg-[#0284C7] transition-colors disabled:opacity-50"
                  >
                    {actionLabel(action)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Positions + History ──────────────────────────────── */}
          <div className="px-[52px] pb-10">
            <div className="flex gap-8">
              {/* Positions */}
              <div className="flex-1 rounded-xl border border-[#E2E8F0] p-6">
                <div className="flex items-center gap-2 mb-5">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                  </svg>
                  <span className="text-[16px] font-medium text-[#0F172A]">Позиции</span>
                </div>

                {items.length === 0 ? (
                  <p className="text-[14px] text-[#94A3B8] italic py-4">
                    Нет позиций. Добавьте через КП или замеры.
                  </p>
                ) : (
                  <>
                    {items.map((item) => (
                      <ItemRow key={item.id} item={item} />
                    ))}
                    <div className="flex items-center justify-between pt-4 mt-2 border-t border-[#0F172A]">
                      <span className="text-[16px] font-bold text-[#0F172A]">ИТОГО</span>
                      <span className="text-[16px] font-bold text-[#0F172A]">
                        {fmtCurrency(order.total_amount)}
                      </span>
                    </div>
                    <div className="flex items-center gap-8 mt-6 text-[14px] text-[#0F172A]">
                      <div className="flex items-center gap-2">
                        <span className="text-[#475569]">Размер предоплаты:</span>
                        <div className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 bg-[#F8FAFC] min-w-[50px] text-center">
                          {prepayPercent}
                        </div>
                        <span className="text-[#94A3B8]">%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#475569]">Внесено:</span>
                        <div className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 bg-[#F8FAFC] min-w-[90px]">
                          {paid > 0 ? paid.toLocaleString("ru-RU") : "0"}
                        </div>
                        <span className="text-[#94A3B8]">₸</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* History */}
              <div className="w-[380px] shrink-0 rounded-xl border border-dashed border-[#CBD5E1] p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Clock size={18} className="text-[#94A3B8]" />
                  <span className="text-[16px] font-medium text-[#0F172A]">История</span>
                </div>
                <HistoryTimeline events={timeline} />
              </div>
            </div>
          </div>

          {/* ── Quick links ──────────────────────────────────────── */}
          {quickLinks.length > 0 && (
            <div className="border-t border-[#F1F5F9] px-[52px] py-4">
              <div className="flex items-center gap-6">
                {quickLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="text-[14px] text-[#475569] hover:text-[#0EA5E9] transition-colors"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Production Stage Modal ─────────────────────────────── */}
      <ProductionStageModal
        isOpen={productionModalOpen}
        onClose={() => setProductionModalOpen(false)}
        orderId={orderId}
        onSuccess={async () => {
          setProductionModalOpen(false);
          await refetchExecution();
        }}
      />

      {/* ── Cancel / Delete confirm ────────────────────────────── */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отменить заказ?</AlertDialogTitle>
            <AlertDialogDescription>
              Заказ №{order.order_number} будет отменён. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2">
            <Textarea
              placeholder="Укажите причину отмены..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="min-h-[80px] text-[14px]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setCancelReason(""); setActionError(null); }}>
              Нет, оставить
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
              className="bg-[#DC2626] hover:bg-[#B91C1C] text-white"
            >
              {cancelMutation.isPending ? "Отмена..." : "Да, отменить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProtectedRoute>
  );
}

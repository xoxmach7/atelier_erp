"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import {
  PageHeader,
  EmptyState,
  LoadingState,
  StatusBadge,
  ErrorState,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useOrders } from "@/hooks/useOrders";
import type { OrderListItemDTO } from "@/types";
import { Plus, ClipboardList } from "lucide-react";
import Link from "next/link";

const ORDER_STATUS_LABELS: Record<string, string> = {
  new: "Новый",
  in_work: "В работе",
  in_production: "В производстве",
  ready: "Готов",
  on_installation: "Установка / выдача",
  waiting_final_payment: "Ожидает финальной оплаты",
  completed: "Завершён",
  cancelled: "Отменён",
  draft: "Черновик",
};

// Check if order ID is valid (not a placeholder/template value)
function isValidOrderId(id: string): boolean {
  if (!id) return false;
  // Block exact placeholder values
  if (id === "[id]" || id === "%5Bid%5D") return false;
  // Block any template pattern like [something]
  if (id.startsWith("[") && id.endsWith("]")) return false;
  return true;
}

function formatCurrency(value: string | number | null | undefined): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (num === null || num === undefined || Number.isNaN(num)) return "₸ 0";
  return `₸ ${num.toLocaleString("ru-RU", { maximumFractionDigits: 0 })}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ru-RU");
}

function getPaymentSignal(order: OrderListItemDTO): { label: string; className: string } {
  const balance = parseFloat(order.balance_due || "0");
  const paid = parseFloat(order.paid_amount || "0");

  if (balance <= 0) {
    return { label: "Оплачено", className: "text-green-600" };
  }

  if (paid > 0) {
    return { label: `Остаток ${formatCurrency(balance)}`, className: "text-amber-600" };
  }

  return { label: "Оплата ожидается", className: "text-slate-600" };
}

function isPaymentClosedForDisplay(order: OrderListItemDTO): boolean {
  const balance = parseFloat(order.balance_due || "0");
  const paid = parseFloat(order.paid_amount || "0");
  const total = parseFloat(order.total_amount || "0");
  return balance <= 0 || (total > 0 && paid >= total);
}

function getStageSignal(order: OrderListItemDTO): { label: string; subtext: string } {
  if (order.status === "waiting_final_payment" && isPaymentClosedForDisplay(order)) {
    return { label: "Оплата закрыта", subtext: "Нужно завершить заказ" };
  }

  return {
    label: ORDER_STATUS_LABELS[order.status] || order.status,
    subtext: "",
  };
}

function getNextAction(order: OrderListItemDTO): string {
  const balance = parseFloat(order.balance_due || "0");
  const status = order.status as string;

  if (status === "waiting_final_payment" && isPaymentClosedForDisplay(order)) {
    return "Проверить готовность и завершить заказ";
  }

  if (status === "new") return "Добавить замер или КП";
  if (status === "in_work") return "Проверить материалы";
  if (status === "in_production") return "Контроль производства";
  if (status === "ready") return "Запланировать выдачу";
  if (status === "on_installation") return "Фотоотчёт и АВР";
  if (status === "draft") return "Уточнить заказ";
  if (status === "waiting_final_payment" || balance > 0) return "Получить финальную оплату";
  if (status === "completed") return "Закрыт";
  if (status === "cancelled") return "Отменён";
  return "Открыть заказ";
}

function OrdersContent() {
  const { data, isLoading, isError, error } = useOrders();

  // Loading state
  if (isLoading) {
    return (
      <>
        <PageHeader
          title="Заказы"
          description="Управление заказами и отслеживание прогресса"
        >
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Новый заказ
          </Button>
        </PageHeader>
        <LoadingState message="Загрузка заказов..." />
      </>
    );
  }

  // Error state
  if (isError) {
    return (
      <>
        <PageHeader
          title="Заказы"
          description="Управление заказами и отслеживание прогресса"
        >
          <Button asChild>
            <Link href="/orders/new">
              <Plus className="mr-2 h-4 w-4" />
              Новый заказ
            </Link>
          </Button>
        </PageHeader>

        <ErrorState
          title="Ошибка загрузки заказов"
          description={error?.message || "Что-то пошло не так. Попробуйте позже."}
          context={`Проверьте, что сервер запущен: ${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api"}`}
        />
      </>
    );
  }

  const orders = data?.results || [];

  // Empty state
  if (orders.length === 0) {
    return (
      <>
        <PageHeader
          title="Заказы"
          description="Управление заказами и отслеживание прогресса"
        >
          <Button asChild>
            <Link href="/orders/new">
              <Plus className="mr-2 h-4 w-4" />
              Новый заказ
            </Link>
          </Button>
        </PageHeader>

        <EmptyState
          title="Нет заказов"
          description={
            <div className="space-y-2">
              <p>Создайте первый заказ напрямую или через КП</p>
              <p className="text-sm text-slate-500">
                Два валидных пути: Клиент → КП → Заказ, или Клиент → Заказ напрямую
              </p>
            </div>
          }
          icon={<ClipboardList className="h-6 w-6 text-slate-600" />}
          action={{
            label: "Создать заказ",
            href: "/orders/new",
          }}
        />
      </>
    );
  }

  // Data table with orders
  return (
    <>
      <PageHeader
        title="Заказы"
        description="Управление заказами и отслеживание прогресса"
      >
        <Button asChild>
          <Link href="/orders/new">
            <Plus className="mr-2 h-4 w-4" />
            Новый заказ
          </Link>
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Заказ №</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Клиент</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Этап</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Оплата</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Следующее действие</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-700">Сумма</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Создан</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((order) => {
                  const isValidId = isValidOrderId(order.id);
                  const displayNumber = order.order_number?.trim() || `Order ${order.id.slice(0, 8)}`;
                  const paymentSignal = getPaymentSignal(order);
                  const stageSignal = getStageSignal(order);
                  return (
                    <tr key={order.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">
                        {isValidId ? (
                          <Link href={`/orders/${order.id}`} className="text-blue-600 hover:underline">
                            {displayNumber}
                          </Link>
                        ) : (
                          <span className="text-red-600" title={`Некорректный ID: ${order.id}`}>
                            {displayNumber} ⚠️
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div>{order.customer_name || "Клиент не указан"}</div>
                        <div className="text-xs text-slate-500">{order.customer_phone || "Телефон не указан"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {order.status === "waiting_final_payment" && isPaymentClosedForDisplay(order) ? (
                            <span className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                              Оплата закрыта
                            </span>
                          ) : (
                            <StatusBadge status={order.status} />
                          )}
                          <div className="text-xs text-slate-500">
                            {stageSignal.subtext || stageSignal.label}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={paymentSignal.className}>
                          {paymentSignal.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {getNextAction(order)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatCurrency(order.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDate(order.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {data && data.count > 0 && (
            <div className="border-t px-4 py-3 text-sm text-slate-500">
              Показано {orders.length} из {data.count} заказов
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export default function OrdersPage() {
  return (
    <ProtectedRoute>
      <OrdersContent />
    </ProtectedRoute>
  );
}

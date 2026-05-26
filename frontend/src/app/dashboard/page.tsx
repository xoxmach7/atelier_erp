"use client";

import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { PageHeader, StatusBadge, LoadingState, ErrorState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOrders } from "@/hooks/useOrders";
import type { OrderListItemDTO } from "@/types";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  PackageCheck,
  Scissors,
  Truck,
} from "lucide-react";

function isOverdue(order: OrderListItemDTO): boolean {
  if (!order.planned_completion) return false;
  if (["completed", "cancelled"].includes(order.status)) return false;
  const due = new Date(order.planned_completion);
  due.setHours(23, 59, 59, 999);
  return due.getTime() < Date.now();
}

function formatCurrency(value: string | number | null | undefined): string {
  const num = typeof value === "string" ? Number.parseFloat(value) : value;
  if (num === null || num === undefined || Number.isNaN(num)) return "₸ 0";
  return `₸ ${num.toLocaleString("ru-RU", { maximumFractionDigits: 0 })}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Дата не указана";
  return new Date(value).toLocaleDateString("ru-RU");
}

function getDisplayOrderNumber(order: OrderListItemDTO): string {
  return order.order_number?.trim() || "Заказ без номера";
}

function DashboardContent() {
  const { data, isLoading, isError, error } = useOrders({ pageSize: 100 });

  if (isLoading) {
    return (
      <>
        <PageHeader title="Рабочий стол" description="Обзор заказов и операционных сигналов" />
        <LoadingState message="Загрузка сводки..." />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Рабочий стол" description="Обзор заказов и операционных сигналов" />
        <ErrorState
          title="Не удалось загрузить рабочий стол"
          description={error?.message || "Проверьте доступность API и попробуйте позже."}
        />
      </>
    );
  }

  const orders = data?.results || [];
  const inWork = orders.filter((order) => order.status === "in_work");
  const inProduction = orders.filter((order) => order.status === "in_production");
  const installation = orders.filter((order) => order.status === "ready" || order.status === "on_installation");
  const awaitingPayment = orders.filter((order) => order.status === "waiting_final_payment");
  const completed = orders.filter((order) => order.status === "completed");
  const overdue = orders.filter(isOverdue);
  const balanceDue = awaitingPayment.reduce((sum, order) => sum + Number.parseFloat(order.balance_due || "0"), 0);
  const recentOrders = orders.slice(0, 5);

  const stats = [
    { title: "Всего заказов", value: orders.length, icon: ClipboardList, helper: "По данным списка заказов" },
    { title: "В работе", value: inWork.length, icon: PackageCheck, helper: "Требуют замеры, КП или материалы" },
    { title: "В производстве", value: inProduction.length, icon: Scissors, helper: "Пошив и контроль готовности" },
    { title: "Установка / выдача", value: installation.length, icon: Truck, helper: "Готовые к передаче клиенту" },
    { title: "Финальная оплата", value: awaitingPayment.length, icon: CreditCard, helper: formatCurrency(balanceDue) },
    { title: "Завершены", value: completed.length, icon: CheckCircle2, helper: "Закрытые заказы" },
  ];

  return (
    <>
      <PageHeader
        title="Рабочий стол"
        description="Owner overview: реальные данные из заказов, без тестовых чисел"
      >
        <Button asChild>
          <Link href="/orders/new">Новый заказ</Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">{stat.title}</CardTitle>
                <Icon className="h-4 w-4 text-sky-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">{stat.value}</div>
                <p className="mt-1 text-xs text-slate-500">{stat.helper}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Последние заказы</CardTitle>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                Заказов пока нет. Создайте первый заказ или примите КП.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="flex flex-col gap-2 py-3 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="font-medium text-slate-900">{getDisplayOrderNumber(order)}</div>
                      <div className="text-sm text-slate-500">
                        {order.customer_name || "Клиент не указан"} · {formatDate(order.created_at)}
                      </div>
                    </div>
                    <StatusBadge status={order.status} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Риски и просрочки
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overdue.length === 0 ? (
              <div className="text-sm text-slate-500">Явных просрочек по плановой дате не найдено.</div>
            ) : (
              <div className="space-y-3">
                {overdue.slice(0, 5).map((order) => (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="block rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm hover:bg-amber-100"
                  >
                    <div className="font-medium text-slate-900">{getDisplayOrderNumber(order)}</div>
                    <div className="text-amber-700">План: {formatDate(order.planned_completion)}</div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

"use client";

import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { PageHeader, StatusBadge, LoadingState, ErrorState } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOrders } from "@/hooks/useOrders";
import type { OrderListItemDTO } from "@/types";
import { ClipboardList, Ruler, Scissors } from "lucide-react";

function formatDate(value: string | null | undefined): string {
  if (!value) return "Срок не указан";
  return new Date(value).toLocaleDateString("ru-RU");
}

function productionHint(order: OrderListItemDTO): string {
  if (order.status === "in_production") return "В производстве";
  if (order.status === "in_work") return "Проверить готовность материалов";
  if (order.status === "ready") return "Готов к выдаче";
  return "Открыть заказ для деталей пошива";
}

function ProductionContent() {
  const { data, isLoading, isError, error } = useOrders({ pageSize: 100 });

  if (isLoading) {
    return (
      <>
        <PageHeader title="Производство" description="Очередь заказов для пошива" />
        <LoadingState message="Загрузка производственной очереди..." />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Производство" description="Очередь заказов для пошива" />
        <ErrorState
          title="Не удалось загрузить производство"
          description={error?.message || "Проверьте API заказов и попробуйте позже."}
        />
      </>
    );
  }

  const orders = (data?.results || []).filter((order) =>
    ["in_work", "in_production", "ready"].includes(order.status)
  );

  return (
    <>
      <PageHeader
        title="Производство"
        description="MVP-экран для швеи: без финансов, с переходом в заказ"
      >
        <Button asChild variant="outline">
          <Link href="/orders">
            <ClipboardList className="mr-2 h-4 w-4" />
            Все заказы
          </Link>
        </Button>
      </PageHeader>

      {orders.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Scissors className="h-8 w-8 text-slate-400" />
            <div>
              <div className="font-medium text-slate-900">Нет заказов в производственной очереди</div>
              <div className="mt-1 text-sm text-slate-500">
                Заказы появятся здесь после перехода в работу или производство.
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => (
            <Card key={order.id} className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {order.order_number || "Заказ без номера"}
                    </CardTitle>
                    <div className="mt-1 text-sm text-slate-500">
                      {order.customer_name || "Клиент не указан"}
                      {order.customer_phone ? ` · ${order.customer_phone}` : ""}
                    </div>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-xs font-medium uppercase text-slate-400">Сигнал</div>
                    <div className="mt-1 text-sm text-slate-900">{productionHint(order)}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-xs font-medium uppercase text-slate-400">План завершения</div>
                    <div className="mt-1 text-sm text-slate-900">{formatDate(order.planned_completion)}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-xs font-medium uppercase text-slate-400">Что шить</div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-slate-900">
                      <Ruler className="h-4 w-4 text-sky-600" />
                      Детали в карточке заказа
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Badge variant="outline">Этап уточняется в карточке заказа</Badge>
                  <Button asChild size="sm">
                    <Link href={`/orders/${order.id}`}>Открыть заказ</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

export default function ProductionPage() {
  return (
    <ProtectedRoute>
      <ProductionContent />
    </ProtectedRoute>
  );
}

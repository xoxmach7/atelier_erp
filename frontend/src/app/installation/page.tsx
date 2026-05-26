"use client";

import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { PageHeader, StatusBadge, LoadingState, ErrorState } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOrders } from "@/hooks/useOrders";
import type { OrderListItemDTO } from "@/types";
import { Camera, ClipboardList, FileSignature, Truck } from "lucide-react";

function formatDate(value: string | null | undefined): string {
  if (!value) return "Дата не указана";
  return new Date(value).toLocaleDateString("ru-RU");
}

function handoverSignal(order: OrderListItemDTO): string {
  if (order.status === "ready") return "Готов к установке / выдаче";
  if (order.status === "on_installation") return "В процессе передачи клиенту";
  if (order.status === "waiting_final_payment") return "Передача выполнена, ожидается финальная оплата";
  return "Проверить карточку заказа";
}

function InstallationContent() {
  const { data, isLoading, isError, error } = useOrders({ pageSize: 100 });

  if (isLoading) {
    return (
      <>
        <PageHeader title="Установка / выдача" description="Очередь установщика" />
        <LoadingState message="Загрузка установок..." />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Установка / выдача" description="Очередь установщика" />
        <ErrorState
          title="Не удалось загрузить установки"
          description={error?.message || "Проверьте API заказов и попробуйте позже."}
        />
      </>
    );
  }

  const orders = (data?.results || []).filter((order) =>
    ["ready", "on_installation", "waiting_final_payment"].includes(order.status)
  );

  return (
    <>
      <PageHeader
        title="Установка / выдача"
        description="MVP-экран для установщика: без лишних финансов"
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
            <Truck className="h-8 w-8 text-slate-400" />
            <div>
              <div className="font-medium text-slate-900">Нет заказов на установку или выдачу</div>
              <div className="mt-1 text-sm text-slate-500">
                Здесь появятся готовые заказы и заказы на этапе передачи клиенту.
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {orders.map((order: OrderListItemDTO) => (
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
                    <div className="text-xs font-medium uppercase text-slate-400">Handover</div>
                    <div className="mt-1 text-sm text-slate-900">{handoverSignal(order)}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-xs font-medium uppercase text-slate-400">План завершения</div>
                    <div className="mt-1 text-sm text-slate-900">{formatDate(order.planned_completion)}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="flex items-center gap-2 text-sm text-slate-900">
                      <Camera className="h-4 w-4 text-sky-600" />
                      Фотоотчёт
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-slate-900">
                      <FileSignature className="h-4 w-4 text-sky-600" />
                      АВР
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Badge variant="outline">Фото и АВР закрываются в карточке заказа</Badge>
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

export default function InstallationPage() {
  return (
    <ProtectedRoute>
      <InstallationContent />
    </ProtectedRoute>
  );
}

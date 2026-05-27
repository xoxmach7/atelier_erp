"use client";

import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ErrorState, LoadingState, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useOrders } from "@/hooks/useOrders";
import type { OrderListItemDTO } from "@/types";
import { Camera, Check, FileSignature, Truck } from "lucide-react";

type DotTone = "red" | "yellow" | "green" | "gray";

function formatDate(value: string | null | undefined): string {
  if (!value) return "Дата не указана";
  return new Date(value).toLocaleDateString("ru-RU");
}

function orderNumber(order: OrderListItemDTO): string {
  return order.order_number?.trim() || "Заказ без номера";
}

function customerName(order: OrderListItemDTO): string {
  return order.customer_name?.trim() || "Клиент не указан";
}

function handoverSignal(order: OrderListItemDTO): string {
  if (order.status === "ready") return "Готов к установке / выдаче";
  if (order.status === "on_installation") return "В процессе передачи";
  if (order.status === "waiting_final_payment") return "Передача выполнена";
  return "Проверить заказ";
}

function statusTone(order: OrderListItemDTO): DotTone {
  if (order.status === "ready") return "yellow";
  if (order.status === "on_installation") return "red";
  if (order.status === "waiting_final_payment") return "green";
  return "gray";
}

function dotClass(tone: DotTone): string {
  if (tone === "red") return "bg-red-500";
  if (tone === "yellow") return "bg-yellow-300";
  if (tone === "green") return "bg-green-500";
  return "bg-slate-300";
}

function InstallationOrderRow({ order }: { order: OrderListItemDTO }) {
  return (
    <div className="border-t border-white bg-neutral-100 px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-neutral-900">
            {orderNumber(order)} · {customerName(order)}
          </div>
          <div className="mt-0.5 text-sm text-neutral-700">{formatDate(order.planned_completion || order.created_at)}</div>
          <div className="mt-0.5 text-sm text-neutral-700">{handoverSignal(order)}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={order.status} />
            <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
              <Camera className="h-3 w-3 text-sky-500" />
              Фото
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
              <FileSignature className="h-3 w-3 text-sky-500" />
              АВР
            </span>
          </div>
        </div>
        <span className={`mt-2 h-6 w-6 shrink-0 rounded-full ${dotClass(statusTone(order))}`} />
      </div>
      <Button asChild size="sm" className="mt-3 h-9 w-full bg-sky-400 hover:bg-sky-500">
        <Link href={`/orders/${order.id}`}>Открыть заказ</Link>
      </Button>
    </div>
  );
}

function InstallationContent() {
  const { data, isLoading, isError, error } = useOrders({ pageSize: 100 });

  if (isLoading) {
    return <LoadingState message="Загрузка установки..." />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Не удалось загрузить установку"
        description={error?.message || "Проверьте API заказов и попробуйте позже."}
      />
    );
  }

  const orders = (data?.results || []).filter((order) =>
    ["ready", "on_installation", "waiting_final_payment"].includes(order.status)
  );

  return (
    <div className="min-h-[calc(100vh-2rem)] bg-neutral-100 px-4 py-6 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="overflow-hidden rounded-[2px] border-0 bg-white shadow-sm">
          <CardContent className="p-0">
            <div className="px-5 pb-5 pt-10">
              <div className="mb-6 text-sm text-neutral-500">Выйти</div>
              <div className="flex items-center justify-between">
                <h1 className="text-3xl font-medium text-neutral-950">Установка</h1>
                <Truck className="h-6 w-6 text-sky-400" />
              </div>
              <div className="mt-3 text-sm text-neutral-500">Заказы на выдачу, фотоотчёт и АВР</div>
            </div>

            <div className="bg-neutral-100">
              {orders.length > 0 ? (
                orders.map((order) => <InstallationOrderRow key={order.id} order={order} />)
              ) : (
                <div className="px-5 py-10 text-center text-sm text-neutral-500">
                  Нет заказов на установку или выдачу.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-0 bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-green-500 text-white">
                  <Check className="h-4 w-4" />
                </span>
                <div>
                  <div className="font-medium text-neutral-950">Рабочая очередь установщика</div>
                  <div className="text-sm text-neutral-500">
                    Установщик открывает заказ, завершает выдачу, добавляет фотоотчёт и работает с АВР.
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/orders">Все заказы</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/mvp-preview">MVP Preview</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function InstallationPage() {
  return (
    <ProtectedRoute>
      <InstallationContent />
    </ProtectedRoute>
  );
}

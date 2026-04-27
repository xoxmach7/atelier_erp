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

// Check if order ID is valid (not a placeholder/template value)
function isValidOrderId(id: string): boolean {
  if (!id) return false;
  // Block exact placeholder values
  if (id === "[id]" || id === "%5Bid%5D") return false;
  // Block any template pattern like [something]
  if (id.startsWith("[") && id.endsWith("]")) return false;
  return true;
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
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Статус</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-700">Сумма</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-700">Баланс</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Создан</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((order) => {
                  const isValidId = isValidOrderId(order.id);
                  const displayNumber = order.order_number?.trim() || `Order ${order.id.slice(0, 8)}`;
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
                        <div>{order.customer_name}</div>
                        <div className="text-xs text-slate-500">{order.customer_phone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        ₸ {(order.total_amount ? parseFloat(order.total_amount).toLocaleString() : "0")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={(order.balance_due && parseFloat(order.balance_due) > 0) ? "text-amber-600" : "text-green-600"}>
                          ₸ {(order.balance_due ? parseFloat(order.balance_due).toLocaleString() : "0")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(order.created_at).toLocaleDateString()}
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

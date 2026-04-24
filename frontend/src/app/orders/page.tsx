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
          context={`Убедитесь, что бэкенд запущен: ${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api"}`}
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
          title="Заказов пока нет"
          description="Создайте первый заказ клиента"
          icon={<ClipboardList className="h-6 w-6 text-slate-600" />}
          action={{
            label: "Создать заказ",
            onClick: () => {},
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
                  <th className="px-4 py-3 text-right font-medium text-slate-700">Итого</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-700">Баланс</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Создан</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/orders/${order.id}`} className="text-blue-600 hover:underline">
                        {order.order_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div>{order.customer_name}</div>
                      <div className="text-xs text-slate-500">{order.customer_phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      ₸ {parseFloat(order.total_amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={parseFloat(order.balance_due) > 0 ? "text-amber-600" : "text-green-600"}>
                        ₸ {parseFloat(order.balance_due).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
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

"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { PageHeader, EmptyState, LoadingState, ErrorState, StatusBadge } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOrders } from "@/hooks/useOrders";
import { usePayments } from "@/hooks/usePayments";
import type { PaymentDTO } from "@/types";
import {
  ArrowRightLeft,
  Banknote,
  CreditCard,
  CreditCard as CardIcon,
  Plus,
  Wallet,
} from "lucide-react";

type PaymentType = "prepayment" | "final" | "additional";
type PaymentMethod = "cash" | "card" | "transfer" | "kaspi";

const paymentTypeLabels: Record<PaymentType, string> = {
  prepayment: "Предоплата",
  final: "Финальный",
  additional: "Дополнительный",
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: "Наличные",
  card: "Карта",
  transfer: "Банковский перевод",
  kaspi: "Kaspi",
};

function formatCurrency(value: string | number | null | undefined): string {
  const num = typeof value === "string" ? Number.parseFloat(value) : value;
  if (num === null || num === undefined || Number.isNaN(num)) return "₸ 0";
  return `₸ ${num.toLocaleString("ru-RU", { maximumFractionDigits: 0 })}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ru-RU");
}

function isInvalidOrderId(orderId: string | null): boolean {
  return !!orderId && (orderId === "[id]" || orderId === "%5Bid%5D" || orderId.includes("["));
}

function PaymentMethodIcon({ method }: { method: PaymentMethod }) {
  const icons = {
    cash: Wallet,
    card: CardIcon,
    transfer: ArrowRightLeft,
    kaspi: CreditCard,
  };
  const Icon = icons[method] || Banknote;
  return <Icon className="h-4 w-4 text-slate-500" />;
}

function truncateNotes(notes: string | null, maxLength = 44): string {
  if (!notes) return "—";
  if (notes.length <= maxLength) return notes;
  return `${notes.slice(0, maxLength)}...`;
}

function PaymentsContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order");
  const invalidOrderId = isInvalidOrderId(orderId);

  const { data, isLoading, isError, error } = usePayments({
    pageSize: 100,
    order: orderId && !invalidOrderId ? orderId : undefined,
  });
  const { data: ordersData } = useOrders({ pageSize: 100 });

  if (isLoading) {
    return (
      <>
        <PageHeader title="Платежи" description="Финансовое закрытие заказов" />
        <LoadingState message="Загрузка платежей..." />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Платежи" description="Финансовое закрытие заказов" />
        <ErrorState
          title="Ошибка загрузки платежей"
          description={error?.message || "Проверьте API платежей и попробуйте позже."}
        />
      </>
    );
  }

  const payments: PaymentDTO[] = data?.results || [];
  const awaitingFinalPayment = (ordersData?.results || []).filter(
    (order) => order.status === "waiting_final_payment" || Number.parseFloat(order.balance_due || "0") > 0
  );
  const totalAmount = payments.reduce((sum, payment) => sum + Number.parseFloat(payment.amount || "0"), 0);

  return (
    <>
      <PageHeader
        title={orderId && !invalidOrderId ? "Платежи по заказу" : "Платежи"}
        description={
          orderId && !invalidOrderId
            ? `${data?.count || 0} платежей по выбранному заказу`
            : `${data?.count || 0} платежей записано`
        }
      >
        {orderId && !invalidOrderId ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/orders/${orderId}`}>К заказу</Link>
          </Button>
        ) : (
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Записать платёж
          </Button>
        )}
      </PageHeader>

      {invalidOrderId && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Некорректный параметр заказа в URL. Ссылка на платежи должна содержать реальный ID заказа.
        </div>
      )}

      {awaitingFinalPayment.length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ожидают финальную оплату</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {awaitingFinalPayment.slice(0, 4).map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="rounded-lg border border-amber-200 bg-white p-3 text-sm hover:bg-amber-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-900">{order.order_number || "Заказ без номера"}</div>
                    <div className="text-slate-500">{order.customer_name || "Клиент не указан"}</div>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
                <div className="mt-2 text-amber-700">Остаток: {formatCurrency(order.balance_due)}</div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {payments.length === 0 ? (
        <EmptyState
          title="Платежей пока нет"
          description={
            orderId && !invalidOrderId
              ? "По выбранному заказу платежи ещё не записаны."
              : "Выберите заказ или откройте карточку заказа для просмотра платежей."
          }
          icon={<Banknote className="h-6 w-6 text-slate-600" />}
        />
      ) : (
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Заказ</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Тип</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Способ</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-700">Сумма</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Получен</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Кем записан</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Примечания</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/orders/${payment.order}`}
                          className="font-medium text-sky-700 hover:underline"
                        >
                          {payment.order_number || "Заказ без номера"}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className="bg-sky-100 text-sky-700">
                          {paymentTypeLabels[payment.payment_type] || payment.payment_type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <PaymentMethodIcon method={payment.payment_method} />
                          <span>{paymentMethodLabels[payment.payment_method] || payment.payment_method}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="px-4 py-3">{formatDate(payment.received_at)}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {payment.created_by_name || "Пользователь не указан"}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-slate-500" title={payment.notes || undefined}>
                        {truncateNotes(payment.notes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between border-t px-4 py-3 text-sm text-slate-500">
              <span>Показано {payments.length} из {data?.count || payments.length}</span>
              <span className="font-medium text-slate-700">Итого: {formatCurrency(totalAmount)}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default function PaymentsPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<LoadingState message="Загрузка платежей..." />}>
        <PaymentsContent />
      </Suspense>
    </ProtectedRoute>
  );
}

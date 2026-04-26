"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import {
  PageHeader,
  EmptyState,
  LoadingState,
  ErrorState,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePayments } from "@/hooks/usePayments";
import type { PaymentDTO } from "@/types";
import { Plus, CreditCard, Wallet, Banknote, CreditCard as CardIcon, ArrowRightLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

// Local type definitions
 type PaymentType = "prepayment" | "final" | "additional";
 type PaymentMethod = "cash" | "card" | "transfer" | "kaspi";

function formatCurrency(value: string | null): string {
  if (!value) return "₸ 0";
  return `₸ ${parseFloat(value).toLocaleString()}`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ru-RU");
}

function PaymentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order");

  // Check if orderId is valid (not a placeholder)
  const isInvalidOrderId = orderId && (orderId === "[id]" || orderId === "%5Bid%5D" || orderId.includes("["));

  const { data, isLoading, isError, error } = usePayments({
    pageSize: 100,
    order: orderId || undefined,
  });

  // Loading state
  if (isLoading) {
    return (
      <>
        <PageHeader title="Платежи" description="Управление и отслеживание платежей">
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Записать платеж
          </Button>
        </PageHeader>
        <LoadingState message="Загрузка платежей..." />
      </>
    );
  }

  // Error state
  if (isError) {
    return (
      <>
        <PageHeader title="Платежи" description="Управление и отслеживание платежей">
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Записать платеж
          </Button>
        </PageHeader>

        <ErrorState
          title="Ошибка загрузки платежей"
          description={error?.message || "Что-то пошло не так. Попробуйте позже."}
        />
      </>
    );
  }

  const payments: PaymentDTO[] = data?.results || [];

  // Empty state
  if (payments.length === 0) {
    return (
      <>
        <PageHeader title="Платежи" description="Управление и отслеживание платежей">
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Записать платеж
          </Button>
        </PageHeader>

        <EmptyState
          title="Платежей пока нет"
          description="Записывайте платежи для отслеживания транзакций по заказам"
          icon={<CreditCard className="h-6 w-6 text-slate-600" />}
          action={{
            label: "Записать первый платеж",
            onClick: () => {},
          }}
        />
      </>
    );
  }

  // Calculate total
  const totalAmount = payments.reduce((sum: number, p: PaymentDTO) => sum + parseFloat(p.amount), 0);

  // Data table
  return (
    <>
      <PageHeader
        title={orderId ? "Платежи по заказу" : "Платежи"}
        description={orderId 
          ? `Фильтр по заказу ${orderId.slice(0, 8)}... • ${data?.count || 0} платежей`
          : `${data?.count || 0} платежей записано`
        }
      >
        {orderId && !isInvalidOrderId ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/orders/${orderId}`}>
                К заказу
              </Link>
            </Button>
          </div>
        ) : isInvalidOrderId ? (
          <div className="text-red-600 text-sm">
            ⚠️ Некорректный ID заказа в URL
          </div>
        ) : (
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Записать платеж
          </Button>
        )}
      </PageHeader>

      <Card>
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
                {payments.map((payment: PaymentDTO) => (
                  <tr key={payment.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/orders/${payment.order}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {payment.order_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPaymentTypeBadgeColor(payment.payment_type)}`}>
                        {getPaymentTypeLabel(payment.payment_type)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getPaymentMethodIcon(payment.payment_method)}
                        <span>{getPaymentMethodLabel(payment.payment_method)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-4 py-3">
                      {payment.received_at ? (
                        <span className="text-green-600">
                          {formatDate(payment.received_at)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {payment.created_by_name || payment.created_by}
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate" title={payment.notes || undefined}>
                      {truncateNotes(payment.notes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data && data.count > 0 && (
            <div className="border-t px-4 py-3 text-sm text-slate-500 flex justify-between">
              <span>Показано {payments.length} из {data.count} платежей</span>
              <span className="font-medium">Итого: {formatCurrency(String(totalAmount))}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function getPaymentTypeLabel(type: PaymentType): string {
  const labels: Record<PaymentType, string> = {
    prepayment: "Предоплата",
    final: "Окончательный",
    additional: "Дополнительный",
  };
  return labels[type] || type;
}

function getPaymentTypeBadgeColor(type: PaymentType): string {
  const colors: Record<PaymentType, string> = {
    prepayment: "bg-amber-100 text-amber-800",
    final: "bg-green-100 text-green-800",
    additional: "bg-blue-100 text-blue-800",
  };
  return colors[type] || "bg-slate-100 text-slate-800";
}

function getPaymentMethodIcon(method: PaymentMethod): React.ReactNode {
  const icons: Record<PaymentMethod, React.ReactNode> = {
    cash: <Wallet className="h-4 w-4" />,
    card: <CardIcon className="h-4 w-4" />,
    transfer: <ArrowRightLeft className="h-4 w-4" />,
    kaspi: <CreditCard className="h-4 w-4" />,
  };
  return icons[method] || <Banknote className="h-4 w-4" />;
}

function getPaymentMethodLabel(method: PaymentMethod): string {
  const labels: Record<PaymentMethod, string> = {
    cash: "Наличные",
    card: "Карта",
    transfer: "Банковский перевод",
    kaspi: "Kaspi",
  };
  return labels[method] || method;
}

function truncateNotes(notes: string | null, maxLength: number = 40): string {
  if (!notes) return "—";
  if (notes.length <= maxLength) return notes;
  return notes.substring(0, maxLength) + "…";
}

export default function PaymentsPage() {
  return (
    <ProtectedRoute>
      <PaymentsContent />
    </ProtectedRoute>
  );
}

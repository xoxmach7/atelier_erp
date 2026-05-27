"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { PageHeader, EmptyState, LoadingState, ErrorState, StatusBadge } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useOrders } from "@/hooks/useOrders";
import { useCreatePayment, usePayments } from "@/hooks/usePayments";
import type { PaymentDTO } from "@/types";
import {
  ArrowRightLeft,
  Banknote,
  CheckCircle2,
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

function parseMoney(value: string | number | null | undefined): number {
  const amount = typeof value === "string" ? Number.parseFloat(value) : value;
  return amount === null || amount === undefined || Number.isNaN(amount) ? 0 : amount;
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
  const createPayment = useCreatePayment();
  const orders = ordersData?.results || [];
  const selectedOrder = orderId && !invalidOrderId
    ? orders.find((order) => order.id === orderId)
    : undefined;
  const defaultOrderForForm = orderId && !invalidOrderId ? orderId : "";
  const [paymentForm, setPaymentForm] = useState({
    order: defaultOrderForForm,
    amount: "",
    payment_type: "final" as PaymentType,
    payment_method: "cash" as PaymentMethod,
    notes: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const formOrder = orders.find((order) => order.id === paymentForm.order) || selectedOrder;
  const remainingAmount = parseMoney(formOrder?.balance_due);

  const handleCreatePayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const amount = Number.parseFloat(paymentForm.amount.replace(",", "."));
    if (!paymentForm.order) {
      setFormError("Выберите заказ для платежа.");
      return;
    }
    if (!paymentForm.amount || Number.isNaN(amount) || amount <= 0) {
      setFormError("Введите сумму платежа больше 0.");
      return;
    }

    try {
      const payment = await createPayment.mutateAsync({
        order: paymentForm.order,
        amount: amount.toFixed(2),
        payment_type: paymentForm.payment_type,
        payment_method: paymentForm.payment_method,
        notes: paymentForm.notes.trim() || undefined,
      });
      setPaymentForm((prev) => ({ ...prev, amount: "", notes: "" }));
      setFormSuccess(`Платёж ${formatCurrency(payment.amount)} записан.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось записать платёж.";
      setFormError(message);
    }
  };

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
  const finalPaymentOrders = (ordersData?.results || []).filter(
    (order) => order.status === "waiting_final_payment" || parseMoney(order.balance_due) > 0
  );
  const totalAmount = payments.reduce((sum, payment) => sum + parseMoney(payment.amount), 0);

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

      <Card className="mb-6 border-sky-200 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4 text-sky-600" />
            Записать платёж
          </CardTitle>
        </CardHeader>
        <CardContent>
          {formOrder && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="font-medium text-slate-900">
                {formOrder.order_number || "Заказ без номера"} · {formOrder.customer_name || "Клиент не указан"}
              </div>
              <div className="mt-1 text-slate-600">
                Итого: {formatCurrency(formOrder.total_amount)} · Оплачено: {formatCurrency(formOrder.paid_amount)} · Остаток: {formatCurrency(formOrder.balance_due)}
              </div>
              {remainingAmount <= 0 && formOrder.status !== "completed" && (
                <div className="mt-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-green-700">
                  Оплата закрыта. Откройте заказ, чтобы проверить блокировки завершения и закрыть его через экран исполнения заказа.
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleCreatePayment} className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
            <div className="space-y-2">
              <Label>Заказ</Label>
              {orderId && !invalidOrderId ? (
                <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {formOrder?.order_number || "Заказ выбран"} {formOrder?.customer_name ? `· ${formOrder.customer_name}` : ""}
                </div>
              ) : (
                <Select
                  value={paymentForm.order}
                  onValueChange={(value) => setPaymentForm((prev) => ({ ...prev, order: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите заказ" />
                  </SelectTrigger>
                  <SelectContent>
                    {orders.map((order) => (
                      <SelectItem key={order.id} value={order.id}>
                        {order.order_number || "Заказ без номера"} · {order.customer_name || "Клиент не указан"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-amount">Сумма</Label>
              <Input
                id="payment-amount"
                inputMode="decimal"
                placeholder={remainingAmount > 0 ? String(Math.round(remainingAmount)) : "0"}
                value={paymentForm.amount}
                onChange={(event) => setPaymentForm((prev) => ({ ...prev, amount: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Тип</Label>
              <Select
                value={paymentForm.payment_type}
                onValueChange={(value: PaymentType) => setPaymentForm((prev) => ({ ...prev, payment_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prepayment">Предоплата</SelectItem>
                  <SelectItem value="final">Финальный</SelectItem>
                  <SelectItem value="additional">Дополнительный</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Способ</Label>
              <Select
                value={paymentForm.payment_method}
                onValueChange={(value: PaymentMethod) => setPaymentForm((prev) => ({ ...prev, payment_method: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Наличные</SelectItem>
                  <SelectItem value="card">Карта</SelectItem>
                  <SelectItem value="transfer">Банковский перевод</SelectItem>
                  <SelectItem value="kaspi">Kaspi</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 lg:col-span-3">
              <Label htmlFor="payment-notes">Комментарий</Label>
              <Textarea
                id="payment-notes"
                rows={2}
                placeholder="Например: финальная оплата после установки"
                value={paymentForm.notes}
                onChange={(event) => setPaymentForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </div>

            <div className="flex items-end">
              <Button type="submit" className="w-full" disabled={createPayment.isPending || invalidOrderId}>
                {createPayment.isPending ? "Записываем..." : "Записать платёж"}
              </Button>
            </div>
          </form>

          {formError && (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </div>
          )}
          {formSuccess && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              {formSuccess}
            </div>
          )}
        </CardContent>
      </Card>

      {finalPaymentOrders.length > 0 && (
        <Card className="mb-6 border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Финальное закрытие</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {finalPaymentOrders.slice(0, 4).map((order) => {
              const balanceDue = parseMoney(order.balance_due);
              const isPaymentClosed = balanceDue <= 0;

              return (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className={
                    isPaymentClosed
                      ? "rounded-lg border border-green-200 bg-green-50 p-3 text-sm hover:bg-green-100"
                      : "rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm hover:bg-amber-100"
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">{order.order_number || "Заказ без номера"}</div>
                      <div className="text-slate-500">{order.customer_name || "Клиент не указан"}</div>
                    </div>
                    {isPaymentClosed ? (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Оплата закрыта</Badge>
                    ) : (
                      <StatusBadge status={order.status} />
                    )}
                  </div>
                  {isPaymentClosed ? (
                    <>
                      <div className="mt-2 text-green-700">
                        Остаток: {formatCurrency(0)}. Откройте заказ для завершения.
                      </div>
                      <div className="mt-2 font-medium text-green-800">Открыть заказ для завершения</div>
                    </>
                  ) : (
                    <div className="mt-2 text-amber-700">Остаток: {formatCurrency(balanceDue)}</div>
                  )}
                </Link>
              );
            })}
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

"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { EmptyState, ErrorState, LoadingState, StatusBadge } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import type { OrderListItemDTO, PaymentDTO } from "@/types";
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
  if (!value) return "Дата не указана";
  return new Date(value).toLocaleDateString("ru-RU");
}

function parseMoney(value: string | number | null | undefined): number {
  const amount = typeof value === "string" ? Number.parseFloat(value) : value;
  return amount === null || amount === undefined || Number.isNaN(amount) ? 0 : amount;
}

function isInvalidOrderId(orderId: string | null): boolean {
  return !!orderId && (orderId === "[id]" || orderId === "%5Bid%5D" || orderId.includes("["));
}

function orderNumber(order: OrderListItemDTO): string {
  return order.order_number?.trim() || "Заказ без номера";
}

function customerName(order: OrderListItemDTO): string {
  return order.customer_name?.trim() || "Клиент не указан";
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

function truncateNotes(notes: string | null, maxLength = 42): string {
  if (!notes) return "—";
  if (notes.length <= maxLength) return notes;
  return `${notes.slice(0, maxLength)}...`;
}

function paymentDot(order: OrderListItemDTO): string {
  const balance = parseMoney(order.balance_due);
  if (balance <= 0) return "bg-green-500";
  if (order.status === "waiting_final_payment") return "bg-red-500";
  return "bg-yellow-300";
}

function FinalPaymentRow({ order }: { order: OrderListItemDTO }) {
  const balanceDue = parseMoney(order.balance_due);
  const isPaymentClosed = balanceDue <= 0;

  return (
    <div className="border-t border-white bg-neutral-100 px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-neutral-900">
            {orderNumber(order)} · {customerName(order)}
          </div>
          <div className={isPaymentClosed ? "mt-1 text-sm text-green-700" : "mt-1 text-sm text-amber-700"}>
            {isPaymentClosed ? "Оплата закрыта" : `Остаток: ${formatCurrency(balanceDue)}`}
          </div>
          <div className="mt-2">
            {isPaymentClosed ? (
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Открыть для завершения</Badge>
            ) : (
              <StatusBadge status={order.status} />
            )}
          </div>
        </div>
        <span className={`mt-2 h-6 w-6 shrink-0 rounded-full ${paymentDot(order)}`} />
      </div>
      <Button asChild size="sm" className="mt-3 h-9 w-full bg-sky-400 hover:bg-sky-500">
        <Link href={isPaymentClosed ? `/orders/${order.id}` : `/payments?order=${order.id}`}>
          {isPaymentClosed ? "Открыть заказ" : "Внести"}
        </Link>
      </Button>
    </div>
  );
}

function PaymentListRow({ payment }: { payment: PaymentDTO }) {
  return (
    <div className="border-t border-white bg-neutral-100 px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href={`/orders/${payment.order}`} className="truncate text-sm font-semibold text-sky-700 hover:underline">
            {payment.order_number || "Заказ без номера"}
          </Link>
          <div className="mt-1 flex items-center gap-2 text-sm text-neutral-700">
            <PaymentMethodIcon method={payment.payment_method} />
            {paymentMethodLabels[payment.payment_method] || payment.payment_method}
          </div>
          <div className="mt-1 text-sm text-neutral-500">
            {paymentTypeLabels[payment.payment_type] || payment.payment_type} · {formatDate(payment.received_at)}
          </div>
          <div className="mt-1 text-xs text-neutral-500">{truncateNotes(payment.notes)}</div>
        </div>
        <div className="text-right text-sm font-semibold text-neutral-950">{formatCurrency(payment.amount)}</div>
      </div>
    </div>
  );
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
    return <LoadingState message="Загрузка платежей..." />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Ошибка загрузки платежей"
        description={error?.message || "Проверьте API платежей и попробуйте позже."}
      />
    );
  }

  const payments: PaymentDTO[] = data?.results || [];
  const finalPaymentOrders = (ordersData?.results || []).filter(
    (order) => order.status === "waiting_final_payment" || parseMoney(order.balance_due) > 0
  );
  const totalAmount = payments.reduce((sum, payment) => sum + parseMoney(payment.amount), 0);

  return (
    <div className="min-h-[calc(100vh-2rem)] bg-neutral-100 px-4 py-6 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[390px_1fr]">
        <Card className="overflow-hidden rounded-[2px] border-0 bg-white shadow-sm">
          <CardContent className="p-0">
            <div className="px-5 pb-5 pt-10">
              <div className="mb-6 text-sm text-neutral-500">
                {orderId && !invalidOrderId ? <Link href={`/orders/${orderId}`}>К заказу</Link> : "Финансы"}
              </div>
              <div className="flex items-center justify-between">
                <h1 className="text-3xl font-medium text-neutral-950">Платежи</h1>
                <Wallet className="h-7 w-7 text-sky-400" />
              </div>
              <div className="mt-3 text-sm text-neutral-500">
                {orderId && !invalidOrderId ? `${data?.count || 0} платежей по заказу` : `${data?.count || 0} платежей записано`}
              </div>
            </div>

            {invalidOrderId && (
              <div className="mx-5 mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                Некорректный параметр заказа в URL. Ссылка должна содержать реальный ID заказа.
              </div>
            )}

            <div className="border-t border-neutral-100 px-5 py-5">
              <div className="mb-4 flex items-center gap-2 text-base font-semibold text-neutral-950">
                <Plus className="h-4 w-4 text-sky-500" />
                Записать платёж
              </div>

              {formOrder && (
                <div className="mb-4 rounded-lg bg-neutral-100 p-3 text-sm">
                  <div className="font-medium text-neutral-900">
                    {orderNumber(formOrder)} · {customerName(formOrder)}
                  </div>
                  <div className="mt-1 text-neutral-600">
                    Итого: {formatCurrency(formOrder.total_amount)} · Оплачено: {formatCurrency(formOrder.paid_amount)}
                  </div>
                  <div className={remainingAmount <= 0 ? "mt-1 text-green-700" : "mt-1 text-amber-700"}>
                    Остаток: {formatCurrency(formOrder.balance_due)}
                  </div>
                  {remainingAmount <= 0 && formOrder.status !== "completed" && (
                    <div className="mt-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-green-700">
                      Оплата закрыта. Откройте заказ для проверки готовности к завершению.
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleCreatePayment} className="space-y-4">
                <div className="space-y-2">
                  <Label>Заказ</Label>
                  {orderId && !invalidOrderId ? (
                    <div className="rounded-md border bg-neutral-100 px-3 py-2 text-sm text-neutral-700">
                      {formOrder ? `${orderNumber(formOrder)} · ${customerName(formOrder)}` : "Заказ выбран"}
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
                            {orderNumber(order)} · {customerName(order)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
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

                <div className="space-y-2">
                  <Label htmlFor="payment-notes">Комментарий</Label>
                  <Textarea
                    id="payment-notes"
                    rows={2}
                    placeholder="Например: финальная оплата после установки"
                    value={paymentForm.notes}
                    onChange={(event) => setPaymentForm((prev) => ({ ...prev, notes: event.target.value }))}
                  />
                </div>

                <Button type="submit" className="w-full bg-sky-400 hover:bg-sky-500" disabled={createPayment.isPending || invalidOrderId}>
                  {createPayment.isPending ? "Записываем..." : "Записать платёж"}
                </Button>
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
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-1">
          <Card className="overflow-hidden rounded-[2px] border-0 bg-white shadow-sm">
            <CardContent className="p-0">
              <div className="px-5 pb-4 pt-6">
                <div className="text-xl font-medium text-neutral-950">Финальное закрытие</div>
                <div className="mt-1 text-sm text-neutral-500">Заказы с остатком или закрытой оплатой</div>
              </div>
              <div className="bg-neutral-100">
                {finalPaymentOrders.length > 0 ? (
                  finalPaymentOrders.slice(0, 6).map((order) => <FinalPaymentRow key={order.id} order={order} />)
                ) : (
                  <div className="px-5 py-10 text-center text-sm text-neutral-500">
                    Нет заказов, ожидающих финальную оплату.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-[2px] border-0 bg-white shadow-sm">
            <CardContent className="p-0">
              <div className="px-5 pb-4 pt-6">
                <div className="text-xl font-medium text-neutral-950">Последние платежи</div>
                <div className="mt-1 text-sm text-neutral-500">Итого: {formatCurrency(totalAmount)}</div>
              </div>
              <div className="bg-neutral-100">
                {payments.length > 0 ? (
                  payments.slice(0, 8).map((payment) => <PaymentListRow key={payment.id} payment={payment} />)
                ) : (
                  <div className="px-5 py-10">
                    <EmptyState
                      title="Платежей пока нет"
                      description={orderId && !invalidOrderId ? "По выбранному заказу платежи ещё не записаны." : "Выберите заказ или откройте карточку заказа для просмотра платежей."}
                      icon={<Banknote className="h-6 w-6 text-slate-600" />}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
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

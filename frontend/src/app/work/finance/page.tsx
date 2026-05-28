"use client";

import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ErrorState, LoadingState, StatusBadge } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useOrders } from "@/hooks/useOrders";
import { usePayments } from "@/hooks/usePayments";
import {
  EmptyRoleState,
  OpenOrderButton,
  OrderTaskCard,
  TaskSection,
  WorkspaceHeader,
  customerName,
  formatDate,
  formatMoney,
  orderNumber,
  parseMoney,
} from "@/components/layout/role-workspace";

function FinanceWorkspace() {
  const ordersQuery = useOrders({ pageSize: 100 });
  const paymentsQuery = usePayments({ pageSize: 20 });

  if (ordersQuery.isLoading || paymentsQuery.isLoading) return <LoadingState message="Загрузка рабочего места финансов..." />;
  if (ordersQuery.isError) return <ErrorState title="Не удалось загрузить заказы" description={ordersQuery.error?.message || "Проверьте API заказов."} />;

  const orders = ordersQuery.data?.results || [];
  const payments = paymentsQuery.data?.results || [];
  const waitingPayment = orders.filter((order) => parseMoney(order.balance_due) > 0 && order.status !== "cancelled");
  const paidNeedsCompletion = orders.filter((order) => order.status === "waiting_final_payment" && parseMoney(order.balance_due) <= 0);

  return (
    <ProtectedRoute>
      <WorkspaceHeader
        title="Финансы / Оплаты"
        description="Финансы закрывают предоплату и финальную оплату. Завершение заказа происходит в заказе после проверки установки, фотоотчёта и подписанного АВР."
      >
        <Button asChild><Link href="/payments">Все платежи</Link></Button>
        <Button asChild variant="outline"><Link href="/orders">Все заказы</Link></Button>
      </WorkspaceHeader>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <TaskSection title="Ожидают оплату" count={waitingPayment.length} description="Показываем заказы с остатком больше 0. Сумма предоплаты свободная, если владелец подтвердил договорённость.">
            <div className="grid gap-3">
              {waitingPayment.slice(0, 10).map((order) => (
                <OrderTaskCard key={order.id} order={order} nextStep={`Остаток: ${formatMoney(order.balance_due)}. Внесите платеж или откройте заказ для проверки условий.`}>
                  <Button asChild size="sm"><Link href={`/payments?order=${order.id}`}>Внести платеж</Link></Button>
                  <OpenOrderButton orderId={order.id} />
                </OrderTaskCard>
              ))}
              {waitingPayment.length === 0 ? <EmptyRoleState text="Нет заказов с открытым остатком оплаты." /> : null}
            </div>
          </TaskSection>

          <TaskSection title="Оплата закрыта, нужно завершить" count={paidNeedsCompletion.length} description="Остаток 0. Откройте заказ и проверьте blockers завершения.">
            <div className="grid gap-3">
              {paidNeedsCompletion.slice(0, 8).map((order) => (
                <Card key={order.id} className="border-emerald-200 bg-white shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-950">{orderNumber(order)}</div>
                        <div className="mt-1 text-sm text-slate-600">{customerName(order)}</div>
                        <div className="mt-1 text-sm text-emerald-700">Оплата закрыта: {formatMoney(order.paid_amount)}</div>
                      </div>
                      <StatusBadge status={order.status} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <OpenOrderButton orderId={order.id} />
                    </div>
                  </CardContent>
                </Card>
              ))}
              {paidNeedsCompletion.length === 0 ? <EmptyRoleState text="Нет полностью оплаченных заказов, ожидающих завершения." /> : null}
            </div>
          </TaskSection>
        </div>

        <TaskSection title="Последние платежи" count={payments.length}>
          <div className="grid gap-3">
            {payments.slice(0, 10).map((payment) => (
              <Card key={payment.id} className="border-slate-200 bg-white shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-950">{payment.order_number || "Заказ без номера"}</div>
                      <div className="mt-1 text-sm text-slate-500">{formatDate(payment.received_at)}</div>
                    </div>
                    <Badge variant="outline">{formatMoney(payment.amount)}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline"><Link href={`/orders/${payment.order}`}>Открыть заказ</Link></Button>
                    <Button asChild size="sm" variant="outline"><Link href={`/payments?order=${payment.order}`}>Платежи</Link></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {payments.length === 0 ? <EmptyRoleState text="Платежей пока нет." /> : null}
          </div>
        </TaskSection>
      </div>
    </ProtectedRoute>
  );
}

export default function FinanceWorkPage() {
  return <FinanceWorkspace />;
}

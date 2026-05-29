"use client";

import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ErrorState, LoadingState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFinanceQueue } from "@/hooks/useWorkQueues";
import type { WorkOrderTask } from "@/services/http/work";
import {
  EmptyRoleState,
  StatusPill,
  TaskSection,
  WorkOrderHeader,
  WorkspaceHeader,
  formatDate,
  formatMoney,
} from "@/components/layout/role-workspace";

function PaymentOrderCard({ task, paid }: { task: WorkOrderTask; paid?: boolean }) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="space-y-3 p-4">
        <WorkOrderHeader task={task} right={<StatusPill label={paid ? "Оплата закрыта" : "Ждёт оплату"} tone={paid ? "green" : "amber"} />} />
        <div className="grid gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 sm:grid-cols-3">
          <div><span className="text-slate-500">Итог</span><br />{formatMoney(task.total_amount)}</div>
          <div><span className="text-slate-500">Оплачено</span><br />{formatMoney(task.paid_amount)}</div>
          <div><span className="text-slate-500">Остаток</span><br />{formatMoney(task.balance_due)}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!paid ? <Button asChild size="sm"><Link href={`/payments?order=${task.id}`}>Внести платёж</Link></Button> : null}
          <Button asChild size="sm" variant="outline"><Link href={`/orders/${task.id}?view=finance`}>Открыть заказ</Link></Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FinanceWorkspace() {
  const queue = useFinanceQueue();

  if (queue.isLoading) return <LoadingState message="Загрузка платежей..." />;
  if (queue.isError) return <ErrorState title="Не удалось загрузить финансы" description={queue.error?.message || "Проверьте API очереди финансов."} />;

  const data = queue.data;

  return (
    <ProtectedRoute>
      <WorkspaceHeader
        title="Платежи"
        description="Финансы в MVP — не отдельная роль исполнителя, а служебный список оплат для владельца и администратора."
      >
        <Button asChild><Link href="/payments">Все платежи</Link></Button>
      </WorkspaceHeader>

      <div className="grid gap-6 xl:grid-cols-2">
        <TaskSection title="Ждут оплату" count={data?.waiting_payment.length || 0}>
          <div className="grid gap-3">
            {data?.waiting_payment.map((task) => <PaymentOrderCard key={task.id} task={task} />)}
            {!data?.waiting_payment.length ? <EmptyRoleState text="Нет заказов с открытым остатком." /> : null}
          </div>
        </TaskSection>

        <TaskSection title="Оплата закрыта, нужно завершить" count={data?.paid_needs_completion.length || 0}>
          <div className="grid gap-3">
            {data?.paid_needs_completion.map((task) => <PaymentOrderCard key={task.id} task={task} paid />)}
            {!data?.paid_needs_completion.length ? <EmptyRoleState text="Нет полностью оплаченных заказов, ожидающих завершения." /> : null}
          </div>
        </TaskSection>

        <Card className="border-slate-200 bg-white shadow-sm xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Последние платежи</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2">
            {data?.recent_payments.map((payment) => (
              <Link key={payment.id} href={`/orders/${payment.order_id}?view=finance`} className="rounded-xl bg-slate-50 p-3 text-sm transition hover:bg-sky-50">
                <div className="font-medium text-slate-900">{payment.order_number} · {payment.customer_name}</div>
                <div className="mt-1 text-slate-500">{formatMoney(payment.amount)} · {formatDate(payment.received_at)}</div>
              </Link>
            ))}
            {!data?.recent_payments.length ? <EmptyRoleState text="Платежей пока нет." /> : null}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}

export default function FinanceWorkPage() {
  return <FinanceWorkspace />;
}

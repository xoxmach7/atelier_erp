"use client";

import Link from "next/link";
import { AlertTriangle, ClipboardList, CreditCard, FileText, PackageCheck, Ruler, Scissors, Truck } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ErrorState, LoadingState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOwnerQueue } from "@/hooks/useWorkQueues";
import type { WorkOrderTask } from "@/services/http/work";
import { StatusPill, formatDate } from "@/components/layout/role-workspace";

const roleLinks = [
  { title: "Дизайнер", href: "/work/designer", helper: "замеры и выбор клиента", icon: Ruler },
  { title: "КП", href: "/work/quotes", helper: "расчёты и согласование", icon: FileText },
  { title: "Склад", href: "/work/warehouse", helper: "материалы и готовность", icon: PackageCheck },
  { title: "Пошив", href: "/work/production", helper: "изделия к изготовлению", icon: Scissors },
  { title: "Установка", href: "/work/installation", helper: "адрес, изделия, фото, АВР", icon: Truck },
];

function OrderLine({ order, view = "admin" }: { order: WorkOrderTask; view?: string }) {
  return (
    <Link href={`/orders/${order.id}${view === "admin" ? "" : `?view=${view}`}`} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 transition hover:bg-sky-50">
      <div className="min-w-0">
        <div className="font-medium text-slate-950">{order.order_number}</div>
        <div className="truncate text-sm text-slate-500">{order.customer_name} · {formatDate(order.planned_completion_date)}</div>
      </div>
      <StatusPill label={order.status_label} tone="sky" />
    </Link>
  );
}

function DashboardContent() {
  const queue = useOwnerQueue();

  if (queue.isLoading) return <LoadingState message="Загрузка пульта владельца..." />;
  if (queue.isError) return <ErrorState title="Не удалось загрузить dashboard" description={queue.error?.message || "Проверьте API owner queue."} />;

  const data = queue.data;
  const counters = [
    { title: "Новые", value: data?.counters.new_orders || 0, icon: ClipboardList },
    { title: "Нужен замер", value: data?.counters.needs_measurement || 0, icon: Ruler },
    { title: "Нужно КП", value: data?.counters.needs_quote || 0, icon: FileText },
    { title: "Материалы", value: data?.counters.materials_not_ready || 0, icon: PackageCheck },
    { title: "В пошиве", value: data?.counters.in_sewing || 0, icon: Scissors },
    { title: "Установка", value: data?.counters.on_installation || 0, icon: Truck },
    { title: "Ждут оплату", value: data?.counters.waiting_payment || 0, icon: CreditCard },
    { title: "Оплачено, закрыть", value: data?.counters.paid_needs_completion || 0, icon: AlertTriangle },
    { title: "Просрочено", value: data?.counters.overdue || 0, icon: AlertTriangle },
  ];

  return (
    <>
      <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm font-medium text-sky-700">Главная</div>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Сегодня</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">Операционный пульт владельца: где затык, какой следующий шаг и в какой кабинет перейти.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild><Link href="/orders/new">Новый заказ</Link></Button>
          <Button asChild variant="outline"><Link href="/orders">Все заказы</Link></Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {counters.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title} className="border-slate-200 bg-white shadow-sm">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-2xl font-semibold text-slate-950">{item.value}</div>
                  <div className="text-sm text-slate-500">{item.title}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6 border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Рабочие кабинеты</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {roleLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-sky-200 hover:bg-sky-50">
                <Icon className="h-5 w-5 text-sky-700" />
                <div className="mt-2 font-medium text-slate-950">{item.title}</div>
                <div className="text-sm text-slate-500">{item.helper}</div>
              </Link>
            );
          })}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader><CardTitle className="text-base">Нужно сделать</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data?.needs_measurement.slice(0, 4).map((order) => <OrderLine key={order.id} order={order} view="designer" />)}
            {data?.needs_quote.slice(0, 4).map((order) => <OrderLine key={order.id} order={order} view="designer" />)}
            {!data?.needs_measurement.length && !data?.needs_quote.length ? <div className="text-sm text-slate-500">Нет срочных задач по замерам и КП.</div> : null}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader><CardTitle className="text-base">Исполнение</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data?.materials_not_ready.slice(0, 3).map((order) => <OrderLine key={order.id} order={order} view="warehouse" />)}
            {data?.in_sewing.slice(0, 3).map((order) => <OrderLine key={order.id} order={order} view="production" />)}
            {data?.on_installation.slice(0, 3).map((order) => <OrderLine key={order.id} order={order} view="installation" />)}
            {!data?.materials_not_ready.length && !data?.in_sewing.length && !data?.on_installation.length ? <div className="text-sm text-slate-500">Нет активных задач исполнения.</div> : null}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader><CardTitle className="text-base">Оплата</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data?.waiting_payment.slice(0, 4).map((order) => <OrderLine key={order.id} order={order} view="finance" />)}
            {data?.paid_needs_completion.slice(0, 4).map((order) => <OrderLine key={order.id} order={order} view="finance" />)}
            {!data?.waiting_payment.length && !data?.paid_needs_completion.length ? <div className="text-sm text-slate-500">Нет открытых финансовых задач.</div> : null}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader><CardTitle className="text-base">Просроченные</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data?.overdue.slice(0, 5).map((order) => <OrderLine key={order.id} order={order} />)}
            {!data?.overdue.length ? <div className="text-sm text-slate-500">Просроченных заказов нет.</div> : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

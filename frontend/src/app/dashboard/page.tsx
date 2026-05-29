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
  { title: "Дизайнер", href: "/work/designer", helper: "замеры и выбор ткани", icon: Ruler },
  { title: "КП", href: "/work/quotes", helper: "расчёты и согласование", icon: FileText },
  { title: "Склад", href: "/work/warehouse", helper: "материалы и readiness", icon: PackageCheck },
  { title: "Пошив", href: "/work/production", helper: "что шить сегодня", icon: Scissors },
  { title: "Установка", href: "/work/installation", helper: "куда ехать и что закрыть", icon: Truck },
];

function OrderLine({ order, view = "admin", nextStep }: { order: WorkOrderTask; view?: string; nextStep: string }) {
  return (
    <Link href={`/orders/${order.id}${view === "admin" ? "" : `?view=${view}`}`} className="block rounded-xl bg-slate-50 p-3 transition hover:bg-sky-50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-slate-950">{order.order_number}</div>
          <div className="truncate text-sm text-slate-500">{order.customer_name} · {formatDate(order.planned_completion_date)}</div>
          <div className="mt-1 text-sm text-sky-800">{nextStep}</div>
        </div>
        <StatusPill label={order.status_label} tone="sky" />
      </div>
    </Link>
  );
}

function DashboardContent() {
  const queue = useOwnerQueue();

  if (queue.isLoading) return <LoadingState message="Загрузка dashboard..." />;
  if (queue.isError) return <ErrorState title="Не удалось загрузить dashboard" description={queue.error?.message || "Проверьте API owner queue."} />;

  const data = queue.data;
  const counters = data?.counters;
  const activeCount = counters
    ? counters.new_orders + counters.needs_measurement + counters.needs_quote + counters.materials_not_ready + counters.in_sewing + counters.on_installation + counters.waiting_payment + counters.paid_needs_completion
    : 0;

  const attention = [
    { title: "Нужен замер", value: counters?.needs_measurement || 0, icon: Ruler, href: "/work/designer", tone: "amber" as const },
    { title: "Нужно КП", value: counters?.needs_quote || 0, icon: FileText, href: "/work/quotes", tone: "amber" as const },
    { title: "Материалы не готовы", value: counters?.materials_not_ready || 0, icon: PackageCheck, href: "/work/warehouse", tone: "red" as const },
    { title: "В пошиве", value: counters?.in_sewing || 0, icon: Scissors, href: "/work/production", tone: "sky" as const },
    { title: "На установке", value: counters?.on_installation || 0, icon: Truck, href: "/work/installation", tone: "sky" as const },
    { title: "Ждут оплату", value: counters?.waiting_payment || 0, icon: CreditCard, href: "/payments", tone: "amber" as const },
    { title: "Оплачено, завершить", value: counters?.paid_needs_completion || 0, icon: AlertTriangle, href: "/work/finance", tone: "green" as const },
    { title: "Просрочено", value: counters?.overdue || 0, icon: AlertTriangle, href: "/orders", tone: "red" as const },
  ];

  const latestOrders = [
    ...(data?.new_orders || []).map((order) => ({ order, view: "designer", nextStep: "назначить замер" })),
    ...(data?.needs_quote || []).map((order) => ({ order, view: "designer", nextStep: "создать КП" })),
    ...(data?.materials_not_ready || []).map((order) => ({ order, view: "warehouse", nextStep: "проверить материалы" })),
    ...(data?.in_sewing || []).map((order) => ({ order, view: "production", nextStep: "контроль пошива" })),
    ...(data?.on_installation || []).map((order) => ({ order, view: "installation", nextStep: "установка / фото / АВР" })),
    ...(data?.waiting_payment || []).map((order) => ({ order, view: "finance", nextStep: "получить оплату" })),
    ...(data?.paid_needs_completion || []).map((order) => ({ order, view: "finance", nextStep: "проверить готовность и завершить" })),
  ].filter((item, index, array) => array.findIndex((candidate) => candidate.order.id === item.order.id) === index).slice(0, 8);

  return (
    <>
      <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm font-medium text-sky-700">Пульт владельца</div>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Сегодня</h1>
          <p className="mt-1 text-sm text-slate-500">Активных сигналов: {activeCount}. Откройте блок с самым большим числом — там текущий затык.</p>
        </div>
        <Button asChild><Link href="/orders/new">Новый заказ</Link></Button>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Требует внимания</h2>
          <p className="text-sm text-slate-500">Короткая карта процесса: замер → КП → материалы → пошив → установка → оплата → завершение.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {attention.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.title} href={item.href} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-200 hover:bg-sky-50">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <StatusPill label={String(item.value)} tone={item.tone} />
                </div>
                <div className="mt-3 font-medium text-slate-950">{item.title}</div>
              </Link>
            );
          })}
        </div>
      </section>

      <Card className="mt-6 border-slate-200 bg-white shadow-sm">
        <CardHeader><CardTitle className="text-base">Рабочие места</CardTitle></CardHeader>
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

      <Card className="mt-6 border-slate-200 bg-white shadow-sm">
        <CardHeader><CardTitle className="text-base">Последние заказы и следующий шаг</CardTitle></CardHeader>
        <CardContent className="grid gap-2 lg:grid-cols-2">
          {latestOrders.map(({ order, view, nextStep }) => <OrderLine key={order.id} order={order} view={view} nextStep={nextStep} />)}
          {!latestOrders.length ? <div className="text-sm text-slate-500">Нет активных заказов для внимания.</div> : null}
        </CardContent>
      </Card>
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

"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ClipboardList,
  CreditCard,
  FileText,
  PackageCheck,
  Ruler,
  Scissors,
  TrendingUp,
  TrendingDown,
  Truck,
} from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ErrorState, LoadingState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOwnerQueue, useDashboard } from "@/hooks/useWorkQueues";
import type { WorkOrderTask, ChartPoint } from "@/services/http/work";
import { StatusPill, formatDate } from "@/components/layout/role-workspace";

const roleLinks = [
  { title: "Дизайнер", href: "/work/designer", helper: "замеры и выбор ткани", icon: Ruler },
  { title: "КП", href: "/work/quotes", helper: "расчёты и согласование", icon: FileText },
  { title: "Склад", href: "/work/warehouse", helper: "материалы и readiness", icon: PackageCheck },
  { title: "Пошив", href: "/work/production", helper: "что шить сегодня", icon: Scissors },
  { title: "Установка", href: "/work/installation", helper: "куда ехать и что закрыть", icon: Truck },
];

function formatMoney(value: number): string {
  return value.toLocaleString("ru-RU") + " ₸";
}

function formatShortMoney(value: number): string {
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + " млн ₸";
  if (value >= 1_000) return (value / 1_000).toFixed(0) + " тыс ₸";
  return value + " ₸";
}

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

function BarChart({ data, mode }: { data: ChartPoint[]; mode: "revenue" | "paid" | "debt" }) {
  const maxValue = Math.max(...data.flatMap((d) => [d.revenue, d.paid]), 1);
  const barColor = mode === "revenue" ? "bg-sky-500" : mode === "paid" ? "bg-green-500" : "bg-red-400";

  return (
    <div className="flex items-end gap-2 h-40">
      {data.map((point, i) => {
        const value = mode === "revenue" ? point.revenue : mode === "paid" ? point.paid : point.revenue - point.paid;
        const heightPercent = maxValue > 0 ? (value / maxValue) * 100 : 0;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex items-end justify-center h-32">
              <div
                className={`w-full max-w-[32px] rounded-t ${barColor} transition-all duration-500`}
                style={{ height: `${Math.max(heightPercent, 4)}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500">{point.month.slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}

function DashboardContent() {
  const queue = useOwnerQueue();
  const dashboard = useDashboard();
  const [chartMode, setChartMode] = useState<"revenue" | "paid" | "debt">("revenue");

  if (queue.isLoading || dashboard.isLoading) return <LoadingState message="Загрузка dashboard..." />;
  if (queue.isError || dashboard.isError) return <ErrorState title="Не удалось загрузить dashboard" description={dashboard.error?.message || queue.error?.message || "Проверьте API."} />;

  const d = dashboard.data;
  const orders = d?.orders;
  const finance = d?.finance;
  const chart = d?.chart || [];

  const counters = queue.data?.counters;
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
    ...(queue.data?.new_orders || []).map((order) => ({ order, view: "designer", nextStep: "назначить замер" })),
    ...(queue.data?.needs_quote || []).map((order) => ({ order, view: "designer", nextStep: "создать КП" })),
    ...(queue.data?.materials_not_ready || []).map((order) => ({ order, view: "warehouse", nextStep: "проверить материалы" })),
    ...(queue.data?.in_sewing || []).map((order) => ({ order, view: "production", nextStep: "контроль пошива" })),
    ...(queue.data?.on_installation || []).map((order) => ({ order, view: "installation", nextStep: "установка / фото / АВР" })),
    ...(queue.data?.waiting_payment || []).map((order) => ({ order, view: "finance", nextStep: "получить оплату" })),
    ...(queue.data?.paid_needs_completion || []).map((order) => ({ order, view: "finance", nextStep: "проверить готовность и завершить" })),
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

      {/* Financial metrics */}
      {finance && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-6">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="text-sm text-slate-500">Выручка</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{formatShortMoney(finance.total_revenue)}</div>
              <div className="mt-1 text-xs text-slate-400">В этом месяце: {formatMoney(finance.this_month_revenue)}</div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="text-sm text-slate-500">Оплачено</div>
              <div className="mt-1 text-2xl font-bold text-green-600">{formatShortMoney(finance.total_paid)}</div>
              <div className="mt-1 text-xs text-slate-400">В этом месяце: {formatMoney(finance.this_month_paid)}</div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="text-sm text-slate-500">Долг</div>
              <div className="mt-1 text-2xl font-bold text-red-600">{formatShortMoney(finance.total_debt)}</div>
              <div className="mt-1 text-xs text-slate-400">{((finance.total_debt / Math.max(finance.total_revenue, 1)) * 100).toFixed(1)}% от выручки</div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="text-sm text-slate-500">Заказов</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{orders?.total ?? 0}</div>
              <div className="mt-1 text-xs text-slate-400">В работе: {orders?.in_work ?? 0} · Завершено: {orders?.completed ?? 0}</div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Counter cards */}
      {orders && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-6">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{orders.in_work}</div>
                <div className="text-xs text-slate-500">В работе</div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-600">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{orders.completed}</div>
                <div className="text-xs text-slate-500">Завершено</div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <TrendingDown className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{orders.overdue}</div>
                <div className="text-xs text-slate-500">Просрочено</div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{orders.awaiting_payment}</div>
                <div className="text-xs text-slate-500">Ожидают оплату</div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Chart */}
      {chart.length > 0 && (
        <Card className="mb-6 border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Динамика за 6 месяцев</CardTitle>
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                {(["revenue", "paid", "debt"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setChartMode(m)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                      chartMode === m
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {m === "revenue" ? "Выручка" : m === "paid" ? "Оплачено" : "Долг"}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <BarChart data={chart} mode={chartMode} />
          </CardContent>
        </Card>
      )}

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

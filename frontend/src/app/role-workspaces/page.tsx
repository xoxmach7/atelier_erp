"use client";

import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOrders } from "@/hooks/useOrders";
import type { OrderListItemDTO } from "@/types";
import {
  Boxes,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  Map,
  PackageCheck,
  Ruler,
  Scissors,
  ShieldAlert,
  Sparkles,
  Truck,
  UserCog,
  WalletCards,
} from "lucide-react";

type DemoStage = {
  number: string;
  label: string;
};

const demoStages: DemoStage[] = [
  { number: "О-2026-901", label: "новый заказ" },
  { number: "О-2026-902", label: "замер" },
  { number: "О-2026-903", label: "КП" },
  { number: "О-2026-904", label: "материалы частично" },
  { number: "О-2026-905", label: "производство" },
  { number: "О-2026-906", label: "установка" },
  { number: "О-2026-907", label: "фотоотчёт / АВР" },
  { number: "О-2026-908", label: "финальная оплата" },
  { number: "О-2026-909", label: "завершён" },
];

function parseMoney(value: string | number | null | undefined): number {
  const amount = typeof value === "string" ? Number.parseFloat(value) : value;
  return amount === null || amount === undefined || Number.isNaN(amount) ? 0 : amount;
}

function formatCurrency(value: string | number | null | undefined): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  }).format(parseMoney(value));
}

function orderNumber(order: OrderListItemDTO): string {
  return order.order_number?.trim() || "Заказ без номера";
}

function customerName(order: OrderListItemDTO): string {
  return order.customer_name?.trim() || "Клиент не указан";
}

function findDemoOrder(orders: OrderListItemDTO[], number: string): OrderListItemDTO | undefined {
  return orders.find((order) => order.order_number === number);
}

function nextStep(order: OrderListItemDTO): string {
  if (order.status === "new") return "Добавить замер и подготовить КП";
  if (order.status === "in_work") return "Проверить КП, материалы и запуск исполнения";
  if (order.status === "in_production") return "Довести пошив до done";
  if (order.status === "ready") return "Запланировать установку / выдачу";
  if (order.status === "on_installation") return "Завершить установку, фотоотчёт и АВР";
  if (order.status === "waiting_final_payment") return parseMoney(order.balance_due) > 0 ? "Закрыть финальную оплату" : "Открыть заказ для завершения";
  if (order.status === "completed") return "Заказ закрыт";
  return "Проверить карточку заказа";
}

function OrderTaskCard({
  order,
  note,
  showMoney = false,
  actions,
}: {
  order: OrderListItemDTO;
  note?: string;
  showMoney?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-900">{orderNumber(order)}</div>
          <div className="text-sm text-slate-500">{customerName(order)}</div>
        </div>
        <StatusBadge status={order.status} />
      </div>
      <div className="mt-2 text-sm text-slate-600">{note || nextStep(order)}</div>
      {showMoney && (
        <div className="mt-2 grid gap-1 text-xs text-slate-600">
          <div>Итого: {formatCurrency(order.total_amount)}</div>
          <div>Оплачено: {formatCurrency(order.paid_amount)}</div>
          <div className={parseMoney(order.balance_due) > 0 ? "text-amber-700" : "text-green-700"}>
            Остаток: {formatCurrency(order.balance_due)}
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href={`/orders/${order.id}`}>Открыть заказ</Link>
        </Button>
        {actions}
      </div>
    </div>
  );
}

function EmptyRoleState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
      {text}
    </div>
  );
}

function WorkspaceCard({
  title,
  icon,
  goal,
  children,
  actions,
}: {
  title: string;
  icon: React.ReactNode;
  goal: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
        <p className="text-sm text-slate-500">{goal}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        {children}
      </CardContent>
    </Card>
  );
}

function RoleWorkspacesContent() {
  const { data, isLoading, isError, error } = useOrders({ pageSize: 100 });

  if (isLoading) {
    return (
      <>
        <PageHeader title="Рабочие места ролей" description="Тестовый режим для проверки Sheber ERP по ролям" />
        <LoadingState message="Загрузка рабочих мест..." />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Рабочие места ролей" description="Тестовый режим для проверки Sheber ERP по ролям" />
        <ErrorState
          title="Не удалось загрузить рабочие места"
          description={error?.message || "Проверьте API заказов и попробуйте позже."}
        />
      </>
    );
  }

  const orders = data?.results || [];
  const newOrders = orders.filter((order) => order.status === "new");
  const inWorkOrders = orders.filter((order) => order.status === "in_work");
  const inProductionOrders = orders.filter((order) => order.status === "in_production");
  const installationOrders = orders.filter((order) => order.status === "ready" || order.status === "on_installation");
  const waitingFinalPayment = orders.filter((order) => order.status === "waiting_final_payment");
  const completedOrders = orders.filter((order) => order.status === "completed");
  const paymentClosedNotCompleted = waitingFinalPayment.filter((order) => parseMoney(order.balance_due) <= 0);

  const demo901 = findDemoOrder(orders, "О-2026-901");
  const demo902 = findDemoOrder(orders, "О-2026-902");
  const demo903 = findDemoOrder(orders, "О-2026-903");
  const demo904 = findDemoOrder(orders, "О-2026-904");
  const demo905 = findDemoOrder(orders, "О-2026-905");
  const demo906 = findDemoOrder(orders, "О-2026-906");
  const demo907 = findDemoOrder(orders, "О-2026-907");
  const demo908 = findDemoOrder(orders, "О-2026-908");
  const demoOrders = demoStages
    .map((demo) => ({ ...demo, order: findDemoOrder(orders, demo.number) }))
    .filter((demo) => demo.order);

  const designerOrders = [demo901, demo902, demo903].filter(Boolean) as OrderListItemDTO[];
  const warehouseOrders = [demo904, ...inWorkOrders.filter((order) => order.order_number !== demo904?.order_number)].slice(0, 4).filter(Boolean) as OrderListItemDTO[];
  const productionOrders = [demo905, ...inProductionOrders.filter((order) => order.order_number !== demo905?.order_number)].filter(Boolean) as OrderListItemDTO[];
  const installerOrders = [demo906, demo907, ...installationOrders.filter((order) => !["О-2026-906", "О-2026-907"].includes(order.order_number))].filter(Boolean) as OrderListItemDTO[];
  const financeOrders = [demo908, ...waitingFinalPayment.filter((order) => order.order_number !== demo908?.order_number), ...paymentClosedNotCompleted].filter(Boolean) as OrderListItemDTO[];

  return (
    <>
      <PageHeader
        title="Рабочие места ролей"
        description="Тестовый режим для проверки Sheber ERP по ролям"
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/product-demo">
              <Sparkles className="mr-2 h-4 w-4" />
              Демо-продукт
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/workflow-map">
              <Map className="mr-2 h-4 w-4" />
              Карта процесса
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </Button>
          <Button asChild>
            <Link href="/orders">Все заказы</Link>
          </Button>
        </div>
      </PageHeader>

      <Card className="mb-6 border-sky-200 bg-sky-50/70 shadow-sm">
        <CardContent className="flex flex-col gap-2 p-4 text-sm text-slate-700 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-semibold text-slate-900">Demo data hint</div>
            <div>Для полного маршрута запустите: <span className="font-mono">python manage.py seed_demo_workflow --reset-demo</span></div>
          </div>
          <Badge className="w-fit bg-sky-100 text-sky-700 hover:bg-sky-100">frontend-only workspace</Badge>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <WorkspaceCard
          title="Владелец / Админ"
          icon={<UserCog className="h-4 w-4 text-sky-600" />}
          goal="Контролирует весь бизнес, статусы заказов, блокеры и закрытие."
          actions={
            <>
              <Button asChild size="sm"><Link href="/orders/new">Создать заказ</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href="/orders">Все заказы</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href="/payments">Платежи</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href="/dashboard">Dashboard</Link></Button>
            </>
          }
        >
          <div className="grid gap-2 sm:grid-cols-3">
            <Badge variant="outline">Новые: {newOrders.length}</Badge>
            <Badge variant="outline">В работе: {inWorkOrders.length}</Badge>
            <Badge variant="outline">Производство: {inProductionOrders.length}</Badge>
            <Badge variant="outline">Установка: {installationOrders.length}</Badge>
            <Badge variant="outline">Оплата: {waitingFinalPayment.length}</Badge>
            <Badge variant="outline">Завершены: {completedOrders.length}</Badge>
          </div>
          {[...newOrders, ...inWorkOrders, ...waitingFinalPayment].slice(0, 5).map((order) => (
            <OrderTaskCard key={order.id} order={order} />
          ))}
          {orders.length === 0 && <EmptyRoleState text="Заказов пока нет. Создайте заказ или запустите demo seed." />}
        </WorkspaceCard>

        <WorkspaceCard
          title="Замерщик / Дизайнер"
          icon={<Ruler className="h-4 w-4 text-sky-600" />}
          goal="Собирает параметры заказа и готовит данные для КП."
          actions={
            <>
              <Button asChild size="sm" variant="outline"><Link href="/measurements">Все замеры</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href="/estimate">Quote Builder</Link></Button>
            </>
          }
        >
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            Здесь фиксируются размеры, ткань, тюль и метры. Цены вводятся позже в КП.
          </p>
          {designerOrders.length > 0 ? designerOrders.map((order) => (
            <OrderTaskCard
              key={order.id}
              order={order}
              note={order.order_number === "О-2026-901" ? "Нужен замер" : order.order_number === "О-2026-902" ? "Замер есть, можно готовить КП" : "Проверьте КП и связь с заказом"}
              actions={
                <>
                  <Button asChild size="sm" variant="outline"><Link href={`/measurements?order=${order.id}`}>Добавить замер</Link></Button>
                  <Button asChild size="sm" variant="outline"><Link href={`/estimate?customer=${order.customer}&order=${order.id}`}>Создать КП</Link></Button>
                </>
              }
            />
          )) : <EmptyRoleState text="Demo-заказы для замерщика не найдены." />}
        </WorkspaceCard>

        <WorkspaceCard
          title="Склад"
          icon={<Boxes className="h-4 w-4 text-sky-600" />}
          goal="Проверяет материалы, остатки и готовность заказа к производству."
          actions={<Button asChild size="sm" variant="outline"><Link href="/inventory">Открыть склад</Link></Button>}
        >
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            В списке заказов нет material_readiness. Точный слой готовности обновляется и проверяется в order detail.
          </p>
          {warehouseOrders.length > 0 ? warehouseOrders.map((order) => (
            <OrderTaskCard
              key={order.id}
              order={order}
              note={order.order_number === "О-2026-904" ? "Demo: материалы частично. Откройте заказ и обновите material_readiness." : "Проверьте материалы в карточке заказа."}
            />
          )) : <EmptyRoleState text="Нет заказов для складской проверки в текущем списке." />}
        </WorkspaceCard>

        <WorkspaceCard
          title="Производство / Швея"
          icon={<Scissors className="h-4 w-4 text-sky-600" />}
          goal="Видит, что нужно шить, без финансовой детализации."
          actions={<Button asChild size="sm" variant="outline"><Link href="/production">Очередь производства</Link></Button>}
        >
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            Швея видит рабочие данные: что шить, размеры, ткань, тюль и этап пошива. Финансовая детализация здесь не нужна.
          </p>
          {productionOrders.length > 0 ? productionOrders.map((order) => (
            <OrderTaskCard
              key={order.id}
              order={order}
              note={order.order_number === "О-2026-905" ? "Demo: заказ в производстве. production_stage смотрите в order detail." : "Заказ находится в производстве."}
            />
          )) : <EmptyRoleState text="Нет заказов со status = in_production." />}
        </WorkspaceCard>

        <WorkspaceCard
          title="Установщик"
          icon={<Truck className="h-4 w-4 text-sky-600" />}
          goal="Видит установку/выдачу, фотоотчёт и АВР."
          actions={<Button asChild size="sm" variant="outline"><Link href="/installation">Очередь установки</Link></Button>}
        >
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            Установщик завершает выдачу/установку, добавляет фотоотчёт и работает с АВР.
          </p>
          {installerOrders.length > 0 ? installerOrders.map((order) => (
            <OrderTaskCard
              key={order.id}
              order={order}
              note={order.order_number === "О-2026-907" ? "Demo: фотоотчёт / АВР. Handover и артефакты смотрите в order detail." : "Проверьте handover_stage, фотоотчёт и АВР в заказе."}
            />
          )) : <EmptyRoleState text="Нет заказов ready / on_installation. Demo O-2026-906 и O-2026-907 появятся после seed." />}
        </WorkspaceCard>

        <WorkspaceCard
          title="Финансы"
          icon={<WalletCards className="h-4 w-4 text-sky-600" />}
          goal="Закрывает оплату и направляет заказ к завершению."
          actions={<Button asChild size="sm" variant="outline"><Link href="/payments">Платежи</Link></Button>}
        >
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            После финального платежа заказ открывается в order detail для проверки готовности к завершению.
          </p>
          {financeOrders.length > 0 ? financeOrders.map((order) => (
            <OrderTaskCard
              key={`${order.id}-finance`}
              order={order}
              showMoney
              note={parseMoney(order.balance_due) > 0 ? "Нужно внести финальный платёж." : "Оплата закрыта. Откройте заказ для завершения."}
              actions={<Button asChild size="sm" variant="outline"><Link href={`/payments?order=${order.id}`}>Внести платёж</Link></Button>}
            />
          )) : <EmptyRoleState text="Нет заказов в ожидании финальной оплаты." />}
        </WorkspaceCard>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Demo orders</CardTitle>
          </CardHeader>
          <CardContent>
            {demoOrders.length === 0 ? (
              <EmptyState
                title="Демо-данные не найдены"
                description="Запустите: python manage.py seed_demo_workflow --reset-demo"
                icon={<PackageCheck className="h-6 w-6 text-slate-600" />}
              />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {demoStages.map((demo) => {
                  const order = findDemoOrder(orders, demo.number);
                  return order ? (
                    <Link
                      key={demo.number}
                      href={`/orders/${order.id}`}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm hover:bg-slate-100"
                    >
                      <div className="font-semibold text-slate-900">{demo.number}</div>
                      <div className="text-slate-500">{demo.label}</div>
                    </Link>
                  ) : (
                    <div key={demo.number} className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-400">
                      {demo.number} не найден
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/70 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4 text-amber-700" />
              Что это за страница
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-amber-800">
            <p>
              Это тестовая обзорная страница рабочих мест. Она не ограничивает доступы по ролям.
              Настоящая RBAC/permissions-система будет отдельным этапом.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline"><Link href="/workflow-map">Карта процесса</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href="/dashboard">Dashboard</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href="/orders">Все заказы</Link></Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}

export default function RoleWorkspacesPage() {
  return (
    <ProtectedRoute>
      <RoleWorkspacesContent />
    </ProtectedRoute>
  );
}

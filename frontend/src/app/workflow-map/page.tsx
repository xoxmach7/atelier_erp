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
  ArrowRight,
  Boxes,
  Camera,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  Map,
  PackageCheck,
  Ruler,
  Scissors,
  Shirt,
  Sparkles,
  Truck,
  UserCog,
  WalletCards,
} from "lucide-react";

type ProcessStep = {
  title: string;
  role: string;
  screen: string;
  href?: string;
  action: string;
  result: string;
  description: string;
};

type RoleCard = {
  title: string;
  screens: string[];
  actions: string[];
};

type ActionRow = {
  stage: string;
  role: string;
  screen: string;
  action: string;
  endpoint: string;
  result: string;
};

const processSteps: ProcessStep[] = [
  {
    title: "Новый заказ",
    role: "Владелец / админ",
    screen: "/orders/new",
    href: "/orders/new",
    action: "Создать заказ",
    result: "status = new",
    description: "Фиксируется клиент, адрес, сроки и стартовая карточка исполнения.",
  },
  {
    title: "Замер",
    role: "Замерщик / дизайнер",
    screen: "/measurements?order=<id>",
    href: "/measurements",
    action: "Добавить room/window, размеры, ткань, тюль и метры",
    result: "Measurement создан, цены не вводятся",
    description: "Measurement отвечает за то, что выбрали и сколько нужно.",
  },
  {
    title: "КП / расчёт",
    role: "Менеджер КП / дизайнер",
    screen: "/estimate?customer=<id>&order=<id>",
    href: "/estimate",
    action: "Рассчитать стоимость",
    result: "Quote + QuoteItems",
    description: "QuoteItem хранит расчёт; тюль живёт внутри позиции КП.",
  },
  {
    title: "Материалы",
    role: "Склад",
    screen: "/orders/[id] или /inventory",
    href: "/inventory",
    action: "Обновить material_readiness",
    result: "not_ready / partially_ready / ready",
    description: "Готовность материалов отдельная от основного статуса заказа.",
  },
  {
    title: "Производство",
    role: "Производство / швея",
    screen: "/production или /orders/[id]",
    href: "/production",
    action: "Передвинуть production_stage",
    result: "not_started -> sewing -> done",
    description: "Швея видит, что шить, размеры, ткани и тюль без лишних финансов.",
  },
  {
    title: "Установка / выдача",
    role: "Установщик",
    screen: "/installation или /orders/[id]",
    href: "/installation",
    action: "Передвинуть handover_stage",
    result: "scheduled -> in_progress -> done",
    description: "Фиксируется передача изделия клиенту или монтаж на адресе.",
  },
  {
    title: "Фотоотчёт",
    role: "Установщик",
    screen: "/orders/[id]",
    href: "/orders",
    action: "Добавить фото исполнения",
    result: "PhotoReport создан",
    description: "PhotoReport является артефактом исполнения, не основным статусом.",
  },
  {
    title: "АВР",
    role: "Установщик / админ",
    screen: "/orders/[id]",
    href: "/orders",
    action: "Создать и загрузить подписанный АВР",
    result: "CompletionAct готов",
    description: "Акт выполненных работ закрывает документальную часть заказа.",
  },
  {
    title: "Финальная оплата",
    role: "Финансы",
    screen: "/payments?order=<id>",
    href: "/payments",
    action: "Внести платёж",
    result: "paid_amount обновлён, balance_due = 0",
    description: "Payment отвечает за финансовое закрытие заказа.",
  },
  {
    title: "Завершение",
    role: "Владелец / админ",
    screen: "/orders/[id]",
    href: "/orders",
    action: "Завершить заказ",
    result: "status = completed",
    description: "Завершение разрешается только backend action и без blockers.",
  },
];

const roleCards: RoleCard[] = [
  {
    title: "Владелец / Админ",
    screens: ["/dashboard", "/orders", "/orders/new", "/orders/[id]", "/quotes", "/payments"],
    actions: ["создать заказ", "контролировать статусы", "видеть блокеры", "завершать заказ"],
  },
  {
    title: "Замерщик / Дизайнер",
    screens: ["/measurements", "/estimate", "/orders/[id]"],
    actions: ["добавить замер", "выбрать ткань", "выбрать тюль", "указать метры", "передать данные в КП"],
  },
  {
    title: "Менеджер КП",
    screens: ["/estimate", "/quotes", "/quotes/[id]"],
    actions: ["создать КП", "проверить позиции", "принять КП", "связать КП с заказом"],
  },
  {
    title: "Склад",
    screens: ["/inventory", "/orders/[id]"],
    actions: ["проверить ткани", "видеть остатки", "обновить material_readiness"],
  },
  {
    title: "Производство / Швея",
    screens: ["/production", "/orders/[id]"],
    actions: ["видеть очередь", "открыть заказ", "отметить sewing / done", "видеть что шить без лишних финансов"],
  },
  {
    title: "Установщик",
    screens: ["/installation", "/orders/[id]"],
    actions: ["видеть установку", "начать/завершить выдачу", "добавить фотоотчёт", "работать с АВР"],
  },
  {
    title: "Финансы",
    screens: ["/payments", "/orders/[id]"],
    actions: ["внести платёж", "проверить остаток", "закрыть финальную оплату"],
  },
];

const actionRows: ActionRow[] = [
  { stage: "Новый заказ", role: "Админ", screen: "/orders/new", action: "Создать заказ", endpoint: "POST /api/v1/orders/", result: "status = new" },
  { stage: "Замер", role: "Замерщик", screen: "/measurements", action: "Добавить замер", endpoint: "POST /api/measurements/", result: "Measurement создан" },
  { stage: "КП", role: "Менеджер", screen: "/estimate", action: "Создать КП", endpoint: "POST /api/quotes/", result: "Quote создан" },
  { stage: "Позиции заказа", role: "Админ", screen: "/orders/[id]", action: "Сформировать позиции", endpoint: "generate-items-from-quote", result: "OrderItems созданы" },
  { stage: "Материалы", role: "Склад", screen: "/orders/[id]", action: "Готовность материалов", endpoint: "change-material-readiness", result: "not_ready / partially_ready / ready" },
  { stage: "Производство", role: "Швея", screen: "/orders/[id]", action: "Стадия производства", endpoint: "change-production-stage", result: "sewing / done" },
  { stage: "Установка", role: "Установщик", screen: "/orders/[id]", action: "Стадия выдачи", endpoint: "change-handover-stage", result: "scheduled / in_progress / done" },
  { stage: "Фотоотчёт", role: "Установщик", screen: "/orders/[id]", action: "Добавить фотоотчёт", endpoint: "photo-reports", result: "PhotoReport создан" },
  { stage: "АВР", role: "Установщик / админ", screen: "/orders/[id]", action: "Создать/загрузить АВР", endpoint: "completion-act", result: "CompletionAct готов" },
  { stage: "Платёж", role: "Финансы", screen: "/payments", action: "Внести платёж", endpoint: "POST /api/payments/", result: "paid_amount обновлён" },
  { stage: "Завершение", role: "Админ", screen: "/orders/[id]", action: "Завершить заказ", endpoint: "transition_to_completed", result: "status = completed" },
];

const demoStages = [
  { number: "О-2026-901", stage: "Новый заказ" },
  { number: "О-2026-902", stage: "Заказ с замером" },
  { number: "О-2026-903", stage: "Заказ с КП" },
  { number: "О-2026-904", stage: "Материалы частично" },
  { number: "О-2026-905", stage: "В производстве" },
  { number: "О-2026-906", stage: "Готов к установке" },
  { number: "О-2026-907", stage: "Фотоотчёт / АВР" },
  { number: "О-2026-908", stage: "Ожидает финальную оплату" },
  { number: "О-2026-909", stage: "Завершённый заказ" },
];

const quickLinks = [
  { title: "Демо-продукт", href: "/product-demo", icon: Sparkles },
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Рабочие места ролей", href: "/role-workspaces", icon: UserCog },
  { title: "Заказы", href: "/orders", icon: ClipboardList },
  { title: "Новый заказ", href: "/orders/new", icon: PackageCheck },
  { title: "Замеры", href: "/measurements", icon: Ruler },
  { title: "КП", href: "/quotes", icon: FileText },
  { title: "Создать КП", href: "/estimate", icon: ClipboardCheck },
  { title: "Производство", href: "/production", icon: Scissors },
  { title: "Установка", href: "/installation", icon: Truck },
  { title: "Склад", href: "/inventory", icon: Boxes },
  { title: "Платежи", href: "/payments", icon: WalletCards },
];

const workingNow = [
  "создание заказа",
  "замеры",
  "КП",
  "payment creation",
  "order detail execution workspace",
  "demo workflow",
];

const temporaryLater = [
  "backend dashboard summary",
  "production queue endpoint",
  "installation queue endpoint",
  "inventory requirements endpoint",
  "полноценный upload фото/АВР",
  "разнос /orders/[id] на секции-компоненты",
];

function findDemoOrder(orders: OrderListItemDTO[], orderNumber: string) {
  return orders.find((order) => order.order_number === orderNumber);
}

function WorkflowMapContent() {
  const { data, isLoading, isError, error } = useOrders({ pageSize: 100 });
  const orders = data?.results || [];
  const demoOrders = demoStages
    .map((demo) => ({ ...demo, order: findDemoOrder(orders, demo.number) }))
    .filter((demo) => demo.order);
  const hasDemoOrders = demoOrders.length > 0;

  if (isLoading) {
    return (
      <>
        <PageHeader title="Карта процесса" description="Роли, этапы, экраны и demo orders Sheber ERP" />
        <LoadingState message="Загрузка карты процесса..." />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Карта процесса" description="Роли, этапы, экраны и demo orders Sheber ERP" />
        <ErrorState
          title="Не удалось загрузить карту процесса"
          description={error?.message || "Проверьте доступность API заказов и попробуйте позже."}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Карта процесса"
        description="Роль -> действие -> экран -> endpoint -> результат. Обзор всей Sheber ERP как единой системы."
      >
        <Button asChild>
          <Link href="/orders">Открыть заказы</Link>
        </Button>
      </PageHeader>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Map className="h-4 w-4 text-sky-600" />
              Сквозной процесс заказа
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {processSteps.map((step, index) => (
              <div key={step.title} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium text-slate-500">Этап {index + 1}</div>
                    <h3 className="font-semibold text-slate-900">{step.title}</h3>
                  </div>
                  <Badge variant="secondary">{step.role}</Badge>
                </div>
                <p className="text-sm text-slate-600">{step.description}</p>
                <div className="mt-3 space-y-1 text-sm">
                  <div><span className="text-slate-500">Экран:</span> {step.href ? <Link className="text-sky-700 hover:underline" href={step.href}>{step.screen}</Link> : step.screen}</div>
                  <div><span className="text-slate-500">Действие:</span> {step.action}</div>
                  <div><span className="text-slate-500">Результат:</span> {step.result}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCog className="h-4 w-4 text-sky-600" />
              Роли и рабочие экраны
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {roleCards.map((role) => (
              <div key={role.title} className="rounded-lg border border-slate-200 p-3">
                <h3 className="font-semibold text-slate-900">{role.title}</h3>
                <div className="mt-2 flex flex-wrap gap-1">
                  {role.screens.map((screen) => (
                    <Badge key={screen} variant="outline">{screen}</Badge>
                  ))}
                </div>
                <div className="mt-2 text-sm text-slate-600">{role.actions.join(" · ")}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="mt-6">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Таблица действий</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="border-b bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Этап</th>
                  <th className="px-4 py-3 font-medium">Роль</th>
                  <th className="px-4 py-3 font-medium">Экран</th>
                  <th className="px-4 py-3 font-medium">Действие</th>
                  <th className="px-4 py-3 font-medium">Endpoint / route</th>
                  <th className="px-4 py-3 font-medium">Результат</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {actionRows.map((row) => (
                  <tr key={`${row.stage}-${row.action}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.stage}</td>
                    <td className="px-4 py-3 text-slate-600">{row.role}</td>
                    <td className="px-4 py-3 text-sky-700">{row.screen}</td>
                    <td className="px-4 py-3 text-slate-600">{row.action}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{row.endpoint}</td>
                    <td className="px-4 py-3 text-slate-600">{row.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      <section className="mt-6">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Demo orders по этапам</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasDemoOrders ? (
              <EmptyState
                title="Демо-данные не найдены"
                description="Запустите: python manage.py seed_demo_workflow --reset-demo"
                icon={<PackageCheck className="h-6 w-6 text-slate-600" />}
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {demoStages.map((demo) => {
                  const order = findDemoOrder(orders, demo.number);
                  return (
                    <div key={demo.number} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">{demo.number}</div>
                          <div className="text-sm text-slate-500">{demo.stage}</div>
                        </div>
                        {order && <StatusBadge status={order.status} />}
                      </div>
                      {order ? (
                        <>
                          <div className="mt-3 text-sm text-slate-600">{order.customer_name || "Клиент не указан"}</div>
                          <Button asChild size="sm" variant="outline" className="mt-3 w-full">
                            <Link href={`/orders/${order.id}`}>Открыть заказ</Link>
                          </Button>
                        </>
                      ) : (
                        <div className="mt-3 text-sm text-slate-500">Заказ не найден в текущих данных.</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Быстрые переходы</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Button key={link.href} asChild variant="outline" className="justify-start">
                  <Link href={link.href}>
                    <Icon className="mr-2 h-4 w-4" />
                    {link.title}
                  </Link>
                </Button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Что работает и что временно</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <h3 className="font-semibold text-green-800">Работает сейчас</h3>
              <ul className="mt-2 space-y-1 text-sm text-green-700">
                {workingNow.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <h3 className="font-semibold text-amber-800">Временно / позже</h3>
              <ul className="mt-2 space-y-1 text-sm text-amber-700">
                {temporaryLater.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}

export default function WorkflowMapPage() {
  return (
    <ProtectedRoute>
      <WorkflowMapContent />
    </ProtectedRoute>
  );
}

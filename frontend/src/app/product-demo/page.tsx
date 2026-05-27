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
  Camera,
  CheckCircle2,
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

type DemoStage = {
  number: string;
  stage: string;
};

type RouteCard = {
  title: string;
  href: string;
  description: string;
  icon: React.ReactNode;
};

const demoStages: DemoStage[] = [
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

const workflow = [
  { title: "Заказ", meaning: "точка входа клиента", role: "Админ", href: "/orders/new", screen: "/orders/new" },
  { title: "Замер", meaning: "размеры, ткань, тюль, метры", role: "Дизайнер", href: "/measurements", screen: "/measurements" },
  { title: "КП", meaning: "цены и итог по QuoteItems", role: "Менеджер КП", href: "/estimate", screen: "/estimate" },
  { title: "Материалы", meaning: "готовность ткани и склада", role: "Склад", href: "/inventory", screen: "/inventory" },
  { title: "Производство", meaning: "что шить и на каком этапе", role: "Швея", href: "/production", screen: "/production" },
  { title: "Установка", meaning: "выдача или монтаж", role: "Установщик", href: "/installation", screen: "/installation" },
  { title: "Фотоотчёт", meaning: "артефакт исполнения", role: "Установщик", href: "/orders", screen: "/orders/[id]" },
  { title: "АВР", meaning: "документ закрытия работ", role: "Админ", href: "/orders", screen: "/orders/[id]" },
  { title: "Оплата", meaning: "финальное закрытие", role: "Финансы", href: "/payments", screen: "/payments" },
  { title: "Завершение", meaning: "status = completed", role: "Админ", href: "/orders", screen: "/orders/[id]" },
];

const workspaces = [
  {
    title: "Владелец / Админ",
    today: "Смотрит состояние бизнеса, открывает blockers и завершает заказы.",
    links: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Заказы", href: "/orders" },
      { label: "Новый заказ", href: "/orders/new" },
    ],
  },
  {
    title: "Замерщик / Дизайнер",
    today: "Фиксирует параметры окна, ткань, тюль и метры без цен.",
    links: [
      { label: "Замеры", href: "/measurements" },
      { label: "Quote Builder", href: "/estimate" },
    ],
  },
  {
    title: "Менеджер КП",
    today: "Собирает стоимость в КП и проверяет позиции расчёта.",
    links: [
      { label: "КП", href: "/quotes" },
      { label: "Создать КП", href: "/estimate" },
    ],
  },
  {
    title: "Склад",
    today: "Проверяет ткани, остатки и готовность материалов.",
    links: [
      { label: "Склад", href: "/inventory" },
      { label: "Заказы", href: "/orders" },
    ],
  },
  {
    title: "Производство / Швея",
    today: "Видит очередь пошива и рабочие данные без финансов.",
    links: [
      { label: "Производство", href: "/production" },
      { label: "Заказы в работе", href: "/orders" },
    ],
  },
  {
    title: "Установщик / Финансы",
    today: "Закрывает установку, АВР, фотоотчёт и финальную оплату.",
    links: [
      { label: "Установка", href: "/installation" },
      { label: "Платежи", href: "/payments" },
    ],
  },
];

const manualTests = [
  { title: "создать заказ", href: "/orders/new" },
  { title: "добавить замер", href: "/measurements" },
  { title: "создать КП", href: "/estimate" },
  { title: "открыть КП", href: "/quotes" },
  { title: "перевести заказ в производство", href: "/orders" },
  { title: "изменить production_stage", href: "/production" },
  { title: "провести установку", href: "/installation" },
  { title: "увидеть фотоотчёт / АВР", href: "/orders" },
  { title: "внести платёж", href: "/payments" },
  { title: "завершить заказ при выполнении условий", href: "/orders" },
];

const modules: RouteCard[] = [
  { title: "Dashboard", href: "/dashboard", description: "обзор бизнеса и операционных сигналов", icon: <LayoutDashboard className="h-4 w-4 text-sky-600" /> },
  { title: "Заказы", href: "/orders", description: "список и вход в execution workspace", icon: <ClipboardList className="h-4 w-4 text-sky-600" /> },
  { title: "Замеры", href: "/measurements", description: "размеры, ткань, тюль и метры", icon: <Ruler className="h-4 w-4 text-sky-600" /> },
  { title: "КП", href: "/quotes", description: "коммерческие предложения и позиции расчёта", icon: <FileText className="h-4 w-4 text-sky-600" /> },
  { title: "Производство", href: "/production", description: "очередь пошива и этапы производства", icon: <Scissors className="h-4 w-4 text-sky-600" /> },
  { title: "Установка", href: "/installation", description: "установка, выдача, фотоотчёт и АВР", icon: <Truck className="h-4 w-4 text-sky-600" /> },
  { title: "Склад", href: "/inventory", description: "ткани, остатки и готовность материалов", icon: <Boxes className="h-4 w-4 text-sky-600" /> },
  { title: "Платежи", href: "/payments", description: "финальное финансовое закрытие", icon: <WalletCards className="h-4 w-4 text-sky-600" /> },
  { title: "Карта процесса", href: "/workflow-map", description: "логика workflow и endpoints", icon: <Map className="h-4 w-4 text-sky-600" /> },
  { title: "Рабочие места ролей", href: "/role-workspaces", description: "как роли видят свои задачи", icon: <UserCog className="h-4 w-4 text-sky-600" /> },
];

const temporaryItems = [
  "production queue пока строится frontend-only",
  "installation queue пока строится frontend-only",
  "dashboard summary пока frontend aggregation",
  "material requirements нужен backend endpoint",
  "/orders/[id] позже надо вынести в секции-компоненты",
  "полноценный upload фото/АВР нужно отдельно пройти руками",
  "настоящая RBAC/permissions-система будет отдельным этапом",
];

function findDemoOrder(orders: OrderListItemDTO[], number: string): OrderListItemDTO | undefined {
  return orders.find((order) => order.order_number === number);
}

function ProductDemoContent() {
  const { data, isLoading, isError, error } = useOrders({ pageSize: 100 });
  const orders = data?.results || [];
  const demoOrders = demoStages
    .map((demo) => ({ ...demo, order: findDemoOrder(orders, demo.number) }))
    .filter((demo) => demo.order);

  if (isLoading) {
    return (
      <>
        <PageHeader title="Демо-продукт Sheber ERP" description="Главный вход в демонстрацию продукта" />
        <LoadingState message="Загрузка demo product shell..." />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Демо-продукт Sheber ERP" description="Главный вход в демонстрацию продукта" />
        <ErrorState
          title="Не удалось загрузить demo product shell"
          description={error?.message || "Проверьте API заказов и попробуйте позже."}
        />
      </>
    );
  }

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <Badge className="mb-3 bg-sky-100 text-sky-700 hover:bg-sky-100">Демо-продукт</Badge>
            <h1 className="text-3xl font-bold text-slate-950">Sheber ERP</h1>
            <p className="mt-2 text-lg text-slate-700">Управление заказами ателье: от замера до оплаты</p>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Система объединяет заказ, замер, КП, материалы, производство, установку, АВР и оплату в один workflow.
              Здесь можно пройти продукт глазами владельца, замерщика, склада, швеи, установщика и финансиста.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild><Link href="/dashboard">Начать с Dashboard</Link></Button>
              <Button asChild variant="outline"><Link href="/orders">Все заказы</Link></Button>
              <Button asChild variant="outline"><Link href="/orders/new">Новый заказ</Link></Button>
              <Button asChild variant="outline"><Link href="/workflow-map">Карта процесса</Link></Button>
              <Button asChild variant="outline"><Link href="/role-workspaces">Рабочие места ролей</Link></Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-2xl font-bold text-slate-950">{orders.length}</div>
              <div className="text-sm text-slate-500">заказов в текущих данных</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-2xl font-bold text-slate-950">{demoOrders.length}/9</div>
              <div className="text-sm text-slate-500">demo orders найдено</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
              <div className="flex items-center gap-2 font-semibold text-slate-900">
                <Sparkles className="h-4 w-4 text-sky-600" />
                Demo scenario
              </div>
              <div className="mt-1 text-sm text-slate-500">О-2026-901 → О-2026-909 показывает путь от нового заказа до завершения.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Главный маршрут заказа</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {workflow.map((step, index) => (
              <Link key={step.title} href={step.href} className="rounded-lg border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100">
                <div className="text-xs font-medium text-slate-500">Шаг {index + 1}</div>
                <div className="mt-1 font-semibold text-slate-900">{step.title}</div>
                <div className="mt-1 text-sm text-slate-600">{step.meaning}</div>
                <div className="mt-3 flex flex-wrap gap-1">
                  <Badge variant="outline">{step.role}</Badge>
                  <Badge variant="secondary">{step.screen}</Badge>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {workspaces.map((workspace) => (
          <Card key={workspace.title} className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{workspace.title}</CardTitle>
              <p className="text-sm text-slate-500">{workspace.today}</p>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {workspace.links.map((link) => (
                <Button key={link.href} asChild size="sm" variant="outline">
                  <Link href={link.href}>{link.label}</Link>
                </Button>
              ))}
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-6">
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
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {demoStages.map((demo) => {
                  const order = findDemoOrder(orders, demo.number);
                  return order ? (
                    <div key={demo.number} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">{demo.number}</div>
                          <div className="text-sm text-slate-500">{order.customer_name || "Клиент не указан"}</div>
                        </div>
                        <StatusBadge status={order.status} />
                      </div>
                      <div className="mt-2 text-sm text-slate-600">{demo.stage}</div>
                      <Button asChild className="mt-3 w-full" size="sm" variant="outline">
                        <Link href={`/orders/${order.id}`}>Открыть</Link>
                      </Button>
                    </div>
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
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Что уже можно тестировать руками</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {manualTests.map((item) => (
              <Link key={item.title} href={item.href} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm hover:bg-slate-100">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                {item.title}
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Основные модули приложения</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {modules.map((module) => (
              <div key={module.href} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  {module.icon}
                  {module.title}
                </div>
                <div className="mt-1 text-sm text-slate-500">{module.description}</div>
                <div className="mt-2 font-mono text-xs text-slate-500">{module.href}</div>
                <Button asChild size="sm" variant="outline" className="mt-3 w-full">
                  <Link href={module.href}>Открыть</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="mt-6">
        <Card className="border-amber-200 bg-amber-50/70 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Что пока временно</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2">
            {temporaryItems.map((item) => (
              <div key={item} className="rounded-lg border border-amber-200 bg-white/70 p-3 text-sm text-amber-800">
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </>
  );
}

export default function ProductDemoPage() {
  return (
    <ProtectedRoute>
      <ProductDemoContent />
    </ProtectedRoute>
  );
}

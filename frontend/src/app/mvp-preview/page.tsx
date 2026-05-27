"use client";

import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useOrders } from "@/hooks/useOrders";
import type { OrderListItemDTO } from "@/types";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Circle,
  Filter,
  LayoutDashboard,
  Map,
  Plus,
  Search,
  Scissors,
  Truck,
  UserCog,
  WalletCards,
} from "lucide-react";

type DotTone = "red" | "yellow" | "green" | "gray";

const demoStages = [
  { number: "О-2026-901", stage: "Новый заказ" },
  { number: "О-2026-902", stage: "Замер" },
  { number: "О-2026-903", stage: "КП" },
  { number: "О-2026-904", stage: "Материалы" },
  { number: "О-2026-905", stage: "Производство" },
  { number: "О-2026-906", stage: "Установка" },
  { number: "О-2026-907", stage: "Фото / АВР" },
  { number: "О-2026-908", stage: "Оплата" },
  { number: "О-2026-909", stage: "Завершён" },
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

function formatDate(value: string | null | undefined): string {
  if (!value) return "Дата не указана";
  return new Date(value).toLocaleDateString("ru-RU");
}

function orderNumber(order: OrderListItemDTO): string {
  return order.order_number?.trim() || "Заказ без номера";
}

function customerName(order: OrderListItemDTO): string {
  return order.customer_name?.trim() || "Клиент не указан";
}

function statusTone(order: OrderListItemDTO): DotTone {
  if (order.status === "waiting_final_payment" || parseMoney(order.balance_due) > 0) return "red";
  if (order.status === "in_work" || order.status === "in_production" || order.status === "ready" || order.status === "on_installation") return "yellow";
  if (order.status === "completed") return "green";
  return "gray";
}

function dotClass(tone: DotTone): string {
  if (tone === "red") return "bg-red-500";
  if (tone === "yellow") return "bg-yellow-400";
  if (tone === "green") return "bg-green-500";
  return "bg-slate-300";
}

function isOverdue(order: OrderListItemDTO): boolean {
  if (!order.planned_completion || ["completed", "cancelled"].includes(order.status)) return false;
  const due = new Date(order.planned_completion);
  due.setHours(23, 59, 59, 999);
  return due.getTime() < Date.now();
}

function findDemoOrder(orders: OrderListItemDTO[], number: string): OrderListItemDTO | undefined {
  return orders.find((order) => order.order_number === number);
}

function PhoneFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[360px]">
      <div className="mb-2 text-sm font-semibold text-slate-500">{title}</div>
      <div className="min-h-[640px] overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        {children}
      </div>
    </div>
  );
}

function ScreenHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 pb-4 pt-8">
      <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
      {action}
    </div>
  );
}

function MiniOrderRow({ order, note, hideMoney = true }: { order: OrderListItemDTO; note?: string; hideMoney?: boolean }) {
  return (
    <Link href={`/orders/${order.id}`} className="flex items-center justify-between border-t border-slate-100 px-5 py-3 hover:bg-slate-50">
      <div>
        <div className="font-medium text-slate-900">{orderNumber(order)}</div>
        <div className="text-sm text-slate-500">{customerName(order)}</div>
        <div className="text-xs text-slate-500">{note || formatDate(order.planned_completion || order.created_at)}</div>
        {!hideMoney && <div className="mt-1 text-xs text-amber-700">Остаток: {formatCurrency(order.balance_due)}</div>}
      </div>
      <span className={`h-5 w-5 rounded-full ${dotClass(statusTone(order))}`} />
    </Link>
  );
}

function LoginPreview() {
  return (
    <PhoneFrame title="Авторизация">
      <div className="flex min-h-[640px] flex-col items-center justify-center px-7">
        <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full border-4 border-sky-300 text-3xl font-bold text-sky-400">
          S
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-slate-950">Единая база</h2>
          <p className="mt-1 text-slate-500">Sheber ERP</p>
        </div>
        <div className="mt-8 w-full space-y-3">
          <Input readOnly placeholder="E-mail/телефон" className="bg-slate-100" />
          <Input readOnly placeholder="Пароль" type="password" className="bg-slate-100" />
          <Button className="w-full bg-sky-400 hover:bg-sky-500">Вход</Button>
        </div>
        <div className="mt-auto pb-6 text-sm text-slate-400">SheberSolution</div>
      </div>
    </PhoneFrame>
  );
}

function AdminDashboardPreview({ orders }: { orders: OrderListItemDTO[] }) {
  const inWork = orders.filter((order) => order.status === "in_work").length;
  const waitingPayment = orders.filter((order) => order.status === "waiting_final_payment").length;
  const overdue = orders.filter(isOverdue).length;
  const bars = [orders.length, inWork, waitingPayment, overdue, orders.filter((order) => order.status === "in_production").length];
  const max = Math.max(...bars, 1);

  return (
    <PhoneFrame title="Администратор-dashboard">
      <div className="px-6 pt-14">
        <h2 className="text-2xl font-semibold text-slate-950">Название организации</h2>
        <div className="mt-1 text-sm text-slate-500">01.09.2025 - н.в. <span className="ml-2">Выбрать период</span></div>
        <div className="mt-5 flex gap-2">
          <Badge variant="secondary">Прибыль</Badge>
          <Badge className="bg-sky-400 hover:bg-sky-400">Выручка</Badge>
          <Badge className="bg-sky-300 hover:bg-sky-300">Расходы</Badge>
        </div>
        <div className="mt-5 flex h-32 items-end gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
          {bars.map((bar, index) => (
            <div key={index} className="flex flex-1 flex-col items-center gap-2">
              <div className="w-full rounded-t bg-sky-300" style={{ height: `${Math.max(10, (bar / max) * 92)}px` }} />
              <span className="text-[10px] text-slate-400">{["Все", "Раб", "Опл", "Прос", "Пош"][index]}</span>
            </div>
          ))}
        </div>
        <div className="mt-6 space-y-3">
          {[
            ["Все заказы", orders.length, null],
            ["В работе", inWork, null],
            ["Ожидают оплаты", waitingPayment, null],
            ["Просрочено", overdue, overdue > 0 ? AlertTriangle : null],
            ["Материалы не готовы", "см. заказ", AlertTriangle],
          ].map(([label, value, Icon]) => (
            <div key={String(label)} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <span className="text-sm text-slate-700">{label as string}</span>
              <span className="flex items-center gap-2 text-xl font-semibold text-sky-400">
                {value as string | number}
                {Icon ? <AlertTriangle className="h-4 w-4 text-amber-500" /> : null}
              </span>
            </div>
          ))}
        </div>
        <Button asChild className="mt-6 w-full bg-sky-400 hover:bg-sky-500">
          <Link href="/dashboard">Открыть dashboard</Link>
        </Button>
      </div>
    </PhoneFrame>
  );
}

function DesignerPreview({ orders }: { orders: OrderListItemDTO[] }) {
  const rows = orders.filter((order) => ["new", "in_work"].includes(order.status)).slice(0, 5);
  return (
    <PhoneFrame title="Дизайнер-Управление заказами">
      <ScreenHeader
        title="Управление заказами"
        action={
          <div className="flex gap-2 text-sky-400">
            <Plus className="h-5 w-5" />
            <Search className="h-5 w-5" />
            <Filter className="h-5 w-5" />
          </div>
        }
      />
      <div className="bg-slate-50 py-2">
        {rows.length > 0 ? rows.map((order) => (
          <MiniOrderRow key={order.id} order={order} note={`Дизайнер: не назначен · ${formatDate(order.created_at)}`} />
        )) : <div className="px-5 py-8 text-sm text-slate-500">Нет заказов для дизайнера.</div>}
      </div>
    </PhoneFrame>
  );
}

function WarehousePreview({ orders }: { orders: OrderListItemDTO[] }) {
  const rows = orders.filter((order) => ["in_work", "in_production"].includes(order.status)).slice(0, 5);
  return (
    <PhoneFrame title="Склад / материалы">
      <ScreenHeader title="Склад" action={<Boxes className="h-5 w-5 text-sky-400" />} />
      <div className="px-5 pb-3 text-sm text-slate-500">Готовность материалов смотрите в заказе</div>
      <div className="bg-slate-50 py-2">
        {rows.length > 0 ? rows.map((order) => (
          <Link key={order.id} href={`/orders/${order.id}`} className="flex items-center justify-between border-t border-slate-100 px-5 py-3 hover:bg-slate-100">
            <div>
              <div className="font-medium text-slate-900">{orderNumber(order)}</div>
              <div className="text-sm text-slate-500">{customerName(order)}</div>
              <div className="text-xs text-slate-500">material_readiness в order detail</div>
            </div>
            {order.order_number === "О-2026-904" ? <AlertTriangle className="h-5 w-5 text-amber-500" /> : <CheckCircle2 className="h-5 w-5 text-green-500" />}
          </Link>
        )) : <div className="px-5 py-8 text-sm text-slate-500">Нет заказов для склада.</div>}
      </div>
      <div className="px-5 pt-4">
        <Button asChild variant="outline" className="w-full"><Link href="/inventory">Открыть склад</Link></Button>
      </div>
    </PhoneFrame>
  );
}

function ProductionPreview({ orders }: { orders: OrderListItemDTO[] }) {
  const demo = findDemoOrder(orders, "О-2026-905");
  const rows = [demo, ...orders.filter((order) => order.status === "in_production" && order.id !== demo?.id)].filter(Boolean).slice(0, 5) as OrderListItemDTO[];
  return (
    <PhoneFrame title="Швейный цех">
      <ScreenHeader title="Заказы" action={<Scissors className="h-5 w-5 text-sky-400" />} />
      <div className="bg-slate-50 py-2">
        {rows.length > 0 ? rows.map((order) => (
          <MiniOrderRow key={order.id} order={order} note={`Дизайнер: не назначен · production_stage в заказе`} />
        )) : <div className="px-5 py-8 text-sm text-slate-500">Нет заказов в пошиве.</div>}
      </div>
      <div className="px-5 pt-4">
        <Button asChild variant="outline" className="w-full"><Link href="/production">Открыть производство</Link></Button>
      </div>
    </PhoneFrame>
  );
}

function InstallerPreview({ orders }: { orders: OrderListItemDTO[] }) {
  const demo906 = findDemoOrder(orders, "О-2026-906");
  const demo907 = findDemoOrder(orders, "О-2026-907");
  const rows = [demo906, demo907, ...orders.filter((order) => ["ready", "on_installation"].includes(order.status) && !["О-2026-906", "О-2026-907"].includes(order.order_number))].filter(Boolean).slice(0, 5) as OrderListItemDTO[];
  return (
    <PhoneFrame title="Установщик">
      <ScreenHeader title="Заказы" action={<Truck className="h-5 w-5 text-sky-400" />} />
      <div className="px-5 pb-3 text-sm text-slate-500">Установщик завершает выдачу, фотоотчёт и АВР</div>
      <div className="bg-slate-50 py-2">
        {rows.length > 0 ? rows.map((order) => (
          <MiniOrderRow key={order.id} order={order} note={order.order_number === "О-2026-907" ? "Фотоотчёт / АВР в заказе" : "handover_stage в заказе"} />
        )) : <div className="px-5 py-8 text-sm text-slate-500">Нет заказов на установку.</div>}
      </div>
      <div className="px-5 pt-4">
        <Button asChild variant="outline" className="w-full"><Link href="/installation">Открыть установку</Link></Button>
      </div>
    </PhoneFrame>
  );
}

function FinancePreview({ orders }: { orders: OrderListItemDTO[] }) {
  const rows = orders.filter((order) => order.status === "waiting_final_payment" || parseMoney(order.balance_due) > 0).slice(0, 5);
  return (
    <PhoneFrame title="Финансы / платежи">
      <ScreenHeader title="Платежи" action={<WalletCards className="h-5 w-5 text-sky-400" />} />
      <div className="bg-slate-50 py-2">
        {rows.length > 0 ? rows.map((order) => {
          const paid = parseMoney(order.balance_due) <= 0;
          return (
            <div key={order.id} className="border-t border-slate-100 px-5 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-900">{orderNumber(order)}</div>
                  <div className="text-sm text-slate-500">{customerName(order)}</div>
                  <div className={paid ? "text-xs text-green-600" : "text-xs text-amber-700"}>
                    {paid ? "Оплата закрыта" : `Остаток: ${formatCurrency(order.balance_due)}`}
                  </div>
                </div>
                <StatusBadge status={order.status} />
              </div>
              <Button asChild size="sm" variant="outline" className="mt-2 w-full">
                <Link href={paid ? `/orders/${order.id}` : `/payments?order=${order.id}`}>
                  {paid ? "Открыть заказ для завершения" : "Внести"}
                </Link>
              </Button>
            </div>
          );
        }) : <div className="px-5 py-8 text-sm text-slate-500">Нет заказов в ожидании оплаты.</div>}
      </div>
      <div className="px-5 pt-4">
        <Button asChild variant="outline" className="w-full"><Link href="/payments">Открыть платежи</Link></Button>
      </div>
    </PhoneFrame>
  );
}

function MvpPreviewContent() {
  const { data, isLoading, isError, error } = useOrders({ pageSize: 100 });
  const orders = data?.results || [];
  const demoOrders = demoStages
    .map((demo) => ({ ...demo, order: findDemoOrder(orders, demo.number) }))
    .filter((demo) => demo.order);

  if (isLoading) {
    return (
      <>
        <PageHeader title="MVP Preview" description="Как будет выглядеть рабочее приложение по ролям" />
        <LoadingState message="Загрузка MVP preview..." />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title="MVP Preview" description="Как будет выглядеть рабочее приложение по ролям" />
        <ErrorState
          title="Не удалось загрузить MVP preview"
          description={error?.message || "Проверьте API заказов и попробуйте позже."}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Sheber ERP MVP Preview"
        description="Как будет выглядеть рабочее приложение по ролям"
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild><Link href="/product-demo">Product Demo</Link></Button>
          <Button variant="outline" asChild><Link href="/workflow-map"><Map className="mr-2 h-4 w-4" />Карта процесса</Link></Button>
          <Button variant="outline" asChild><Link href="/role-workspaces"><UserCog className="mr-2 h-4 w-4" />Рабочие места</Link></Button>
          <Button asChild><Link href="/orders">Заказы</Link></Button>
        </div>
      </PageHeader>

      <div className="rounded-2xl bg-slate-200/70 p-5">
        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <LoginPreview />
          <AdminDashboardPreview orders={orders} />
          <DesignerPreview orders={orders} />
          <WarehousePreview orders={orders} />
          <ProductionPreview orders={orders} />
          <InstallerPreview orders={orders} />
          <FinancePreview orders={orders} />
        </div>
      </div>

      <section className="mt-6">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Demo scenario</CardTitle>
          </CardHeader>
          <CardContent>
            {demoOrders.length === 0 ? (
              <EmptyState
                title="Демо-данные не найдены"
                description="Запустите: python manage.py seed_demo_workflow --reset-demo"
                icon={<Circle className="h-6 w-6 text-slate-600" />}
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {demoStages.map((demo) => {
                  const order = findDemoOrder(orders, demo.number);
                  return order ? (
                    <Button key={demo.number} asChild size="sm" variant="outline">
                      <Link href={`/orders/${order.id}`}>{demo.number} · {demo.stage}</Link>
                    </Button>
                  ) : (
                    <Badge key={demo.number} variant="outline">{demo.number} не найден</Badge>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="mt-6 border-sky-200 bg-sky-50/70 shadow-sm">
        <CardContent className="p-4 text-sm text-slate-700">
          Это визуальный MVP-preview рабочих экранов. Он не заменяет реальные страницы и не включает RBAC.
          Нужен, чтобы увидеть, как будет выглядеть конечное приложение по ролям.
        </CardContent>
      </Card>
    </>
  );
}

export default function MvpPreviewPage() {
  return (
    <ProtectedRoute>
      <MvpPreviewContent />
    </ProtectedRoute>
  );
}

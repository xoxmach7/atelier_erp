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
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  ClipboardList,
  Filter,
  LayoutDashboard,
  Map,
  Plus,
  Search,
  Scissors,
  Truck,
  UserCog,
  UserPlus,
  WalletCards,
} from "lucide-react";

type DotTone = "red" | "yellow" | "green" | "gray";
type MaterialTone = "alert" | "warning" | "ready";

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

const sampleItems = [
  { room: "Гостиная", window: "Окно 1", size: "100x150", done: true },
  { room: "Гостиная", window: "Окно 2", size: "100x150", done: false },
  { room: "Спальня", window: "Окно 1", size: "200x200", done: false },
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

function shortDate(value: string | null | undefined): string {
  if (!value) return "Дата не указана";
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
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
  if (tone === "yellow") return "bg-yellow-300";
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

function pickOrders(orders: OrderListItemDTO[], statuses: string[], demoNumbers: string[], limit = 5): OrderListItemDTO[] {
  const demos = demoNumbers.map((number) => findDemoOrder(orders, number)).filter(Boolean) as OrderListItemDTO[];
  const matched = orders.filter((order) => statuses.includes(order.status) && !demoNumbers.includes(order.order_number));
  const unique = [...demos, ...matched].filter((order, index, list) => list.findIndex((item) => item.id === order.id) === index);
  return unique.slice(0, limit);
}

function materialTone(order: OrderListItemDTO): MaterialTone {
  if (order.order_number === "О-2026-904") return "warning";
  if (order.status === "new" || order.status === "in_work") return "alert";
  return "ready";
}

function PhoneFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[340px]">
      <div className="mb-2 text-sm font-semibold text-neutral-500">{title}</div>
      <div className="min-h-[620px] overflow-hidden rounded-[2px] bg-white shadow-sm ring-1 ring-black/5">
        {children}
      </div>
    </div>
  );
}

function PhoneScreen({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`min-h-[620px] bg-white ${className}`}>{children}</div>;
}

function BackLabel({ text = "Назад" }: { text?: string }) {
  return <div className="px-6 pt-14 text-sm text-neutral-500">{text}</div>;
}

function IconButton({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-400 text-white">
      {children}
    </span>
  );
}

function ActionIcons({ plus = false }: { plus?: boolean }) {
  return (
    <div className="flex items-center justify-end gap-3">
      {plus ? (
        <IconButton>
          <Plus className="h-5 w-5" />
        </IconButton>
      ) : null}
      <IconButton>
        <Search className="h-4 w-4" />
      </IconButton>
      <IconButton>
        <Filter className="h-4 w-4" />
      </IconButton>
    </div>
  );
}

function OrderRow({
  order,
  designer = "Дизайнер не назначен",
  tone,
}: {
  order: OrderListItemDTO;
  designer?: string;
  tone?: DotTone;
}) {
  return (
    <Link href={`/orders/${order.id}`} className="flex min-h-[78px] items-center justify-between border-t border-white bg-neutral-100 px-6 py-3 hover:bg-neutral-50">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-neutral-800">{orderNumber(order)} [{customerName(order)}]</div>
        <div className="text-sm text-neutral-700">{shortDate(order.planned_completion || order.created_at)}</div>
        <div className="truncate text-sm text-neutral-700">{designer}</div>
      </div>
      <span className={`ml-4 h-6 w-6 shrink-0 rounded-full ${dotClass(tone || statusTone(order))}`} />
    </Link>
  );
}

function MaterialIcon({ tone }: { tone: MaterialTone }) {
  if (tone === "ready") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-green-500 text-white">
        <Check className="h-4 w-4" />
      </span>
    );
  }
  if (tone === "warning") {
    return <AlertTriangle className="h-6 w-6 text-amber-500" />;
  }
  return <AlertTriangle className="h-6 w-6 text-red-500" />;
}

function MaterialRow({ order }: { order: OrderListItemDTO }) {
  const tone = materialTone(order);
  return (
    <Link href={`/orders/${order.id}`} className="flex min-h-[78px] items-center justify-between border-t border-white bg-neutral-100 px-6 py-3 hover:bg-neutral-50">
      <div>
        <div className="text-sm font-medium text-neutral-800">{orderNumber(order)} [{customerName(order)}]</div>
        <div className="text-sm text-neutral-700">{shortDate(order.planned_completion || order.created_at)}</div>
        <div className="text-sm text-neutral-700">
          {tone === "ready" ? "Материалы готовы" : tone === "warning" ? "Часть материалов в работе" : "Нужно проверить материалы"}
        </div>
      </div>
      <MaterialIcon tone={tone} />
    </Link>
  );
}

function ItemRow({ item, active = false }: { item: (typeof sampleItems)[number]; active?: boolean }) {
  return (
    <div className="flex min-h-[56px] items-center justify-between border-t border-white bg-neutral-100 px-6 py-2">
      <div>
        <div className="text-sm text-neutral-800">{item.room}</div>
        <div className="text-sm text-neutral-700">{item.window} ({item.size})</div>
      </div>
      {active ? (
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-green-500 text-white">
          <Check className="h-4 w-4" />
        </span>
      ) : (
        <Check className="h-5 w-5 text-neutral-400" />
      )}
    </div>
  );
}

function PreviewField({
  placeholder,
  wide = false,
  icon,
}: {
  placeholder: string;
  wide?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className={`flex h-10 items-center rounded-lg bg-neutral-200 px-3 text-xs text-neutral-500 ${wide ? "col-span-2" : ""}`}>
      {icon ? <span className="mr-2 text-neutral-500">{icon}</span> : null}
      <span className="truncate">{placeholder}</span>
    </div>
  );
}

function LoginPreview() {
  return (
    <PhoneFrame title="Авторизация">
      <PhoneScreen className="flex flex-col items-center justify-center px-8">
        <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full border-4 border-sky-300 text-3xl font-bold text-sky-400">
          S
        </div>
        <div className="text-center">
          <h2 className="text-3xl font-medium text-neutral-950">Единая база</h2>
          <p className="mt-2 text-neutral-700">Название организации</p>
        </div>
        <div className="mt-8 w-full space-y-3">
          <Input readOnly placeholder="E-mail/телефон" className="h-10 border-0 bg-neutral-200 text-sm" />
          <Input readOnly placeholder="Пароль" type="password" className="h-10 border-0 bg-neutral-200 text-sm" />
          <Button className="h-10 w-full bg-sky-400 hover:bg-sky-500">Вход</Button>
        </div>
        <div className="mt-auto pb-6 text-sm text-neutral-400">SheberSolution</div>
      </PhoneScreen>
    </PhoneFrame>
  );
}

function AdminDashboardPreview({ orders }: { orders: OrderListItemDTO[] }) {
  const inWork = orders.filter((order) => order.status === "in_work").length;
  const waitingPayment = orders.filter((order) => order.status === "waiting_final_payment").length;
  const overdue = orders.filter(isOverdue).length;
  const materialAttention = orders.filter((order) => materialTone(order) !== "ready").length;
  const bars = [orders.length, inWork, waitingPayment, overdue, materialAttention, orders.filter((order) => order.status === "completed").length];
  const max = Math.max(...bars, 1);

  return (
    <PhoneFrame title="Администратор-dashboard">
      <PhoneScreen className="px-7 pt-16">
        <h2 className="text-2xl font-medium text-neutral-950">Название организации</h2>
        <div className="mt-1 text-sm text-neutral-500">01.09.2025 - н.в. <span className="ml-2">Выбрать период</span></div>
        <div className="mt-5 flex gap-2">
          <Badge variant="secondary" className="rounded-md bg-neutral-200 px-4 text-neutral-500">Прибыль</Badge>
          <Badge className="rounded-md bg-sky-400 px-4 hover:bg-sky-400">Выручка</Badge>
          <Badge className="rounded-md bg-sky-300 px-4 hover:bg-sky-300">Расходы</Badge>
        </div>
        <div className="mt-5 flex h-36 items-end gap-3 border border-neutral-100 bg-neutral-50 px-4 py-3">
          {bars.map((bar, index) => (
            <div key={index} className="flex flex-1 flex-col items-center gap-2">
              <div className="w-full bg-sky-300" style={{ height: `${Math.max(8, (bar / max) * 96)}px` }} />
              <span className="text-[10px] text-neutral-400">{["Все", "Раб", "Опл", "Прос", "Мат", "Гот"][index]}</span>
            </div>
          ))}
        </div>
        <div className="mt-6 space-y-3">
          {[
            ["Все заказы", orders.length, null],
            ["В работе", inWork, null],
            ["Ожидают оплаты", waitingPayment, null],
            ["Просрочено", overdue, overdue > 0 ? "alert" : null],
            ["Материалы на исходе", materialAttention, materialAttention > 0 ? "alert" : null],
          ].map(([label, value, alert]) => (
            <Link key={String(label)} href="/dashboard" className="flex items-center justify-between rounded-xl bg-neutral-100 px-4 py-3 hover:bg-neutral-50">
              <span className="text-sm text-neutral-800">{label as string}</span>
              <span className="flex items-center gap-2 text-xl font-medium text-sky-400">
                {value as number}
                {alert ? <AlertTriangle className="h-4 w-4 text-red-500" /> : null}
              </span>
            </Link>
          ))}
        </div>
        <Button asChild className="mt-6 w-full bg-sky-400 hover:bg-sky-500">
          <Link href="/dashboard">Выйти из профиля</Link>
        </Button>
      </PhoneScreen>
    </PhoneFrame>
  );
}

function AdminOrdersPreview({ orders }: { orders: OrderListItemDTO[] }) {
  const rows = orders.slice(0, 5);
  return (
    <PhoneFrame title="Администратор-Управление заказами">
      <PhoneScreen>
        <BackLabel />
        <div className="px-6 pb-4 pt-3">
          <h2 className="text-2xl font-medium text-neutral-950">Управление заказами</h2>
          <div className="mt-5">
            <ActionIcons plus />
          </div>
        </div>
        <div className="bg-neutral-100">
          {rows.length > 0 ? rows.map((order) => (
            <OrderRow key={order.id} order={order} designer={order.order_number === "О-2026-902" ? "Дизайнер: Ибраева" : "Дизайнер: Калиева"} />
          )) : <div className="px-6 py-8 text-sm text-neutral-500">Заказы пока не созданы.</div>}
        </div>
      </PhoneScreen>
    </PhoneFrame>
  );
}

function DesignerOrdersPreview({ orders }: { orders: OrderListItemDTO[] }) {
  const rows = pickOrders(orders, ["new", "in_work"], ["О-2026-901", "О-2026-902", "О-2026-903"], 5);
  return (
    <PhoneFrame title="Дизайнер-Управление заказами">
      <PhoneScreen>
        <div className="px-6 pt-14 text-sm text-neutral-500">Выйти</div>
        <div className="px-6 pb-4 pt-3">
          <h2 className="text-2xl font-medium text-neutral-950">Управление заказами</h2>
          <div className="mt-5">
            <ActionIcons plus />
          </div>
        </div>
        <div className="bg-neutral-100">
          {rows.length > 0 ? rows.map((order) => (
            <OrderRow key={order.id} order={order} designer={order.order_number === "О-2026-901" ? "Нужен замер" : "Дизайнер: Калиева"} />
          )) : <div className="px-6 py-8 text-sm text-neutral-500">Нет заказов для дизайнера.</div>}
        </div>
      </PhoneScreen>
    </PhoneFrame>
  );
}

function DesignerMeasurementsPreview({ order }: { order?: OrderListItemDTO }) {
  return (
    <PhoneFrame title="Дизайнер-Замеры">
      <PhoneScreen>
        <BackLabel />
        <div className="px-6 pb-4 pt-3">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-medium text-neutral-950">{order ? orderNumber(order) : "Заказ №1"} (замеры)</h2>
          </div>
          <div className="mt-5 flex items-center justify-between">
            <Button asChild size="sm" className="h-7 rounded-md bg-blue-500 px-3 text-xs hover:bg-blue-600">
              <Link href={order ? `/estimate?customer=${order.customer}&order=${order.id}` : "/estimate"}>
                <ClipboardList className="mr-1 h-3 w-3" />Создать КП
              </Link>
            </Button>
            <div className="flex gap-3">
              <IconButton><Plus className="h-5 w-5" /></IconButton>
              <IconButton><Filter className="h-4 w-4" /></IconButton>
            </div>
          </div>
        </div>
        <div className="bg-neutral-100">
          {sampleItems.map((item, index) => (
            <div key={`${item.room}-${item.window}-${index}`} className="flex min-h-[56px] items-center justify-between border-t border-white px-6 py-2">
              <div>
                <div className="text-sm text-neutral-800">{item.room}</div>
                <div className="text-sm text-neutral-700">{item.window} ({item.size})</div>
              </div>
              <div className="text-right text-sm text-neutral-800">
                {index === 0 ? "6 м ткани" : index === 1 ? "5 м ткани" : "8 м ткани"}
                {index === 2 ? <div className="text-[11px] text-neutral-500">за 2 шт.</div> : null}
              </div>
            </div>
          ))}
        </div>
      </PhoneScreen>
    </PhoneFrame>
  );
}

function WarehouseOrdersPreview({ orders }: { orders: OrderListItemDTO[] }) {
  const rows = pickOrders(orders, ["in_work", "in_production"], ["О-2026-904", "О-2026-905", "О-2026-906"], 5);
  return (
    <PhoneFrame title="Менеджер склада-Заказы">
      <PhoneScreen>
        <div className="px-6 pt-14 text-sm text-neutral-500">Выйти</div>
        <div className="px-6 pb-4 pt-3">
          <h2 className="text-center text-2xl font-medium text-neutral-950">Заказы</h2>
          <div className="mt-5">
            <ActionIcons />
          </div>
        </div>
        <div className="bg-neutral-100">
          {rows.length > 0 ? rows.map((order) => (
            <MaterialRow key={order.id} order={order} />
          )) : <div className="px-6 py-8 text-sm text-neutral-500">Нет заказов для склада.</div>}
        </div>
        <div className="px-6 pt-6 text-sm leading-6 text-neutral-800">
          <div>1. Закупить</div>
          <div>2. Сделано</div>
          <div>3. Нужно сделать</div>
        </div>
      </PhoneScreen>
    </PhoneFrame>
  );
}

function WarehouseOverlayPreview() {
  return (
    <PhoneFrame title="Менеджер склада overlay">
      <PhoneScreen className="px-7 pt-12">
        <div className="ml-auto flex h-7 w-7 items-center justify-center rounded-md bg-sky-400 text-white">
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <div className="mt-7">
          <div className="text-base font-semibold text-neutral-950">Материалы:</div>
          <div className="text-sm text-neutral-700">Материалы из КП.</div>
        </div>
      </PhoneScreen>
    </PhoneFrame>
  );
}

function ProductionOrdersPreview({ orders }: { orders: OrderListItemDTO[] }) {
  const rows = pickOrders(orders, ["in_production"], ["О-2026-905"], 5);
  return (
    <PhoneFrame title="Швейный цех-Заказы">
      <PhoneScreen>
        <div className="px-6 pt-14 text-sm text-neutral-500">Выйти</div>
        <div className="px-6 pb-4 pt-3">
          <h2 className="text-center text-2xl font-medium text-neutral-950">Заказы</h2>
          <div className="mt-5">
            <ActionIcons />
          </div>
        </div>
        <div className="bg-neutral-100">
          {rows.length > 0 ? rows.map((order) => (
            <OrderRow key={order.id} order={order} designer="Дизайнер: Ибраева" tone={order.order_number === "О-2026-905" ? "red" : "yellow"} />
          )) : <div className="px-6 py-8 text-sm text-neutral-500">Нет заказов в пошиве.</div>}
        </div>
      </PhoneScreen>
    </PhoneFrame>
  );
}

function RoleItemsPreview({
  title,
  label,
  order,
  activeFirst = true,
}: {
  title: string;
  label: string;
  order?: OrderListItemDTO;
  activeFirst?: boolean;
}) {
  return (
    <PhoneFrame title={label}>
      <PhoneScreen>
        <BackLabel />
        <div className="px-6 pb-6 pt-3">
          <div className="flex items-center justify-between">
            <h2 className="text-center text-2xl font-medium text-neutral-950">{order ? orderNumber(order) : title}</h2>
            <IconButton><Filter className="h-4 w-4" /></IconButton>
          </div>
        </div>
        <div className="bg-neutral-100">
          {sampleItems.map((item, index) => (
            <ItemRow key={`${item.room}-${item.window}-${index}`} item={item} active={activeFirst && index === 0} />
          ))}
        </div>
      </PhoneScreen>
    </PhoneFrame>
  );
}

function InstallerOrdersPreview({ orders }: { orders: OrderListItemDTO[] }) {
  const rows = pickOrders(orders, ["ready", "on_installation"], ["О-2026-906", "О-2026-907"], 5);
  return (
    <PhoneFrame title="Установщик-Заказы">
      <PhoneScreen>
        <div className="px-6 pt-14 text-sm text-neutral-500">Выйти</div>
        <div className="px-6 pb-4 pt-3">
          <h2 className="text-center text-2xl font-medium text-neutral-950">Заказы</h2>
          <div className="mt-5">
            <ActionIcons />
          </div>
        </div>
        <div className="bg-neutral-100">
          {rows.length > 0 ? rows.map((order) => (
            <OrderRow key={order.id} order={order} designer={order.order_number === "О-2026-907" ? "Фотоотчёт / АВР" : "Готов к установке"} />
          )) : <div className="px-6 py-8 text-sm text-neutral-500">Нет заказов на установку.</div>}
        </div>
      </PhoneScreen>
    </PhoneFrame>
  );
}

function FinancePreview({ orders }: { orders: OrderListItemDTO[] }) {
  const rows = orders.filter((order) => order.status === "waiting_final_payment" || parseMoney(order.balance_due) > 0).slice(0, 4);
  return (
    <PhoneFrame title="Финансы-Платежи">
      <PhoneScreen>
        <div className="px-6 pt-14 text-sm text-neutral-500">Назад</div>
        <div className="px-6 pb-4 pt-3">
          <h2 className="text-center text-2xl font-medium text-neutral-950">Платежи</h2>
        </div>
        <div className="bg-neutral-100">
          {rows.length > 0 ? rows.map((order) => {
            const paid = parseMoney(order.balance_due) <= 0;
            return (
              <div key={order.id} className="border-t border-white px-6 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-neutral-900">{orderNumber(order)} [{customerName(order)}]</div>
                    <div className={paid ? "text-sm text-green-600" : "text-sm text-amber-700"}>
                      {paid ? "Оплата закрыта" : `Остаток: ${formatCurrency(order.balance_due)}`}
                    </div>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
                <Button asChild size="sm" className="mt-2 h-8 w-full bg-sky-400 hover:bg-sky-500">
                  <Link href={paid ? `/orders/${order.id}` : `/payments?order=${order.id}`}>
                    {paid ? "Открыть заказ" : "Внести"}
                  </Link>
                </Button>
              </div>
            );
          }) : <div className="px-6 py-8 text-sm text-neutral-500">Нет заказов в ожидании оплаты.</div>}
        </div>
      </PhoneScreen>
    </PhoneFrame>
  );
}

function OrderCreatePreview() {
  return (
    <PhoneFrame title="Администратор-Создание заказа">
      <PhoneScreen className="px-6">
        <BackLabel />
        <h2 className="pt-3 text-center text-2xl font-medium text-neutral-950">Создание заказа</h2>
        <div className="mt-5 space-y-4 text-sm text-neutral-900">
          <div>
            <div className="mb-2">1. Клиент <span className="text-red-500">*</span></div>
            <div className="flex gap-2">
              <PreviewField placeholder="Фамилия/телефон" wide icon={<Search className="h-4 w-4" />} />
              <IconButton><UserPlus className="h-4 w-4" /></IconButton>
            </div>
          </div>
          <div>
            <div className="mb-2">2. Дизайнер</div>
            <PreviewField placeholder="Выберите дизайнера" wide icon={<ChevronDown className="h-4 w-4" />} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-2">3. Дата замера</div>
              <PreviewField placeholder="__.__.__" icon={<CalendarDays className="h-4 w-4" />} />
            </div>
            <div>
              <div className="mb-2">4. Завершение</div>
              <PreviewField placeholder="__.__.__" icon={<CalendarDays className="h-4 w-4" />} />
            </div>
          </div>
          <div>
            <div className="mb-2">5. Адрес установки</div>
            <div className="grid grid-cols-2 gap-3">
              <PreviewField placeholder="Город" />
              <PreviewField placeholder="Улица" />
              <PreviewField placeholder="Дом" />
              <PreviewField placeholder="Квартира" />
              <PreviewField placeholder="Примечание" wide />
            </div>
          </div>
          <Button asChild className="mt-4 w-full bg-sky-400 hover:bg-sky-500">
            <Link href="/orders/new">Создать</Link>
          </Button>
        </div>
      </PhoneScreen>
    </PhoneFrame>
  );
}

function MeasurementCreatePreview({ order }: { order?: OrderListItemDTO }) {
  return (
    <PhoneFrame title="Дизайнер-Создание замера">
      <PhoneScreen className="px-6">
        <BackLabel />
        <h2 className="pt-3 text-center text-2xl font-medium text-neutral-950">Создание замера</h2>
        <div className="mt-5 space-y-4 text-sm text-neutral-900">
          <div>
            <div className="mb-2">1. Комната <span className="text-red-500">*</span></div>
            <PreviewField placeholder="Например: Гостиная" wide />
          </div>
          <div>
            <div className="mb-2">2. Окно/изделие <span className="text-red-500">*</span></div>
            <PreviewField placeholder="Например: Окно 1" wide />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-2">3. Ширина (см) <span className="text-red-500">*</span></div>
              <PreviewField placeholder="" />
            </div>
            <div>
              <div className="mb-2">4. Высота (см) <span className="text-red-500">*</span></div>
              <PreviewField placeholder="" />
            </div>
          </div>
          <div>
            <div className="mb-2 flex justify-between"><span>5. Ткань штор</span><span className="text-neutral-500">метры</span></div>
            <div className="grid grid-cols-[1fr_52px] gap-3">
              <PreviewField placeholder="" icon={<ChevronDown className="h-4 w-4" />} />
              <PreviewField placeholder="" />
            </div>
          </div>
          <div>
            <div className="mb-2 flex justify-between"><span>6. Ткань тюля</span><span className="text-neutral-500">метры</span></div>
            <div className="grid grid-cols-[1fr_52px] gap-3">
              <PreviewField placeholder="" icon={<ChevronDown className="h-4 w-4" />} />
              <PreviewField placeholder="" />
            </div>
          </div>
          <div>
            <div className="mb-2">7. Тип крепления</div>
            <PreviewField placeholder="Выберите крепление" wide icon={<ChevronDown className="h-4 w-4" />} />
          </div>
          <div>
            <div className="mb-2">8. Комментарии по изделию</div>
            <PreviewField placeholder="Примечание" wide />
          </div>
          <Button asChild className="mt-4 w-full bg-sky-400 hover:bg-sky-500">
            <Link href={order ? `/measurements?order=${order.id}` : "/measurements"}>Создать</Link>
          </Button>
        </div>
      </PhoneScreen>
    </PhoneFrame>
  );
}

function DemoScenarioStrip({ orders }: { orders: OrderListItemDTO[] }) {
  const demoOrders = demoStages
    .map((demo) => ({ ...demo, order: findDemoOrder(orders, demo.number) }))
    .filter((demo) => demo.order);

  return (
    <section className="mt-6">
      <Card className="border-neutral-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Демо-сценарий</CardTitle>
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
  );
}

function MvpPreviewContent() {
  const { data, isLoading, isError, error } = useOrders({ pageSize: 100 });
  const orders = data?.results || [];
  const demo902 = findDemoOrder(orders, "О-2026-902");
  const demo905 = findDemoOrder(orders, "О-2026-905");
  const demo906 = findDemoOrder(orders, "О-2026-906");

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
        description="Визуальный preview конечного приложения: простые рабочие кабинеты ролей на реальных демо-заказах"
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild><Link href="/product-demo">Демо-продукт</Link></Button>
          <Button variant="outline" asChild><Link href="/workflow-map"><Map className="mr-2 h-4 w-4" />Карта процесса</Link></Button>
          <Button variant="outline" asChild><Link href="/role-workspaces"><UserCog className="mr-2 h-4 w-4" />Рабочие места</Link></Button>
          <Button asChild><Link href="/orders">Заказы</Link></Button>
        </div>
      </PageHeader>

      <div className="rounded-sm bg-[#d3d3d3] p-5 md:p-8">
        <div className="grid gap-x-12 gap-y-10 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <LoginPreview />
          <AdminDashboardPreview orders={orders} />
          <DesignerOrdersPreview orders={orders} />
          <ProductionOrdersPreview orders={orders} />
          <WarehouseOrdersPreview orders={orders} />
          <InstallerOrdersPreview orders={orders} />
          <AdminOrdersPreview orders={orders} />
          <DesignerMeasurementsPreview order={demo902} />
          <RoleItemsPreview title="Заказ №1" label="Швейный цех-Изделия" order={demo905} />
          <WarehouseOverlayPreview />
          <RoleItemsPreview title="Заказ №1" label="Установщик-Изделия" order={demo906} />
          <OrderCreatePreview />
          <MeasurementCreatePreview order={demo902} />
          <FinancePreview orders={orders} />
        </div>
      </div>

      <DemoScenarioStrip orders={orders} />

      <Card className="mt-6 border-sky-200 bg-sky-50/70 shadow-sm">
        <CardContent className="p-4 text-sm text-slate-700">
          Это визуальный MVP-preview рабочих экранов. Он не заменяет реальные страницы и не включает RBAC.
          Здесь проверяется направление продукта: владелец видит dashboard, а швея, склад, установщик и финансы получают простые рабочие списки.
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

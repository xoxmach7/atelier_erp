"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared";
import type { OrderListItemDTO } from "@/types";

export function parseMoney(value: string | number | null | undefined): number {
  const amount = typeof value === "string" ? Number.parseFloat(value) : value;
  return amount === null || amount === undefined || Number.isNaN(amount) ? 0 : amount;
}

export function formatMoney(value: string | number | null | undefined): string {
  return `₸ ${parseMoney(value).toLocaleString("ru-RU", { maximumFractionDigits: 0 })}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "Дата не указана";
  return new Date(value).toLocaleDateString("ru-RU");
}

export function orderNumber(order: OrderListItemDTO): string {
  return order.order_number?.trim() || "Заказ без номера";
}

export function customerName(order: OrderListItemDTO): string {
  return order.customer_name?.trim() || "Клиент не указан";
}

export function isOverdue(order: OrderListItemDTO): boolean {
  if (!order.planned_completion || ["completed", "cancelled"].includes(order.status)) return false;
  const due = new Date(order.planned_completion);
  due.setHours(23, 59, 59, 999);
  return due.getTime() < Date.now();
}

export function WorkspaceHeader({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div className="text-sm font-medium text-sky-700">Рабочее место</div>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>
      </div>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}

export function OrderTaskCard({
  order,
  nextStep,
  children,
}: {
  order: OrderListItemDTO;
  nextStep: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold text-slate-950">{orderNumber(order)}</div>
            <div className="mt-1 text-sm text-slate-600">
              {customerName(order)}
              {order.customer_phone ? ` · ${order.customer_phone}` : ""}
            </div>
            <div className="mt-1 text-sm text-slate-500">Срок: {formatDate(order.planned_completion || order.created_at)}</div>
          </div>
          <StatusBadge status={order.status} />
        </div>
        <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">{nextStep}</div>
        <div className="mt-3 flex flex-wrap gap-2">{children}</div>
      </CardContent>
    </Card>
  );
}

export function TaskSection({
  title,
  description,
  count,
  children,
}: {
  title: string;
  description?: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          {description ? <p className="text-sm text-slate-500">{description}</p> : null}
        </div>
        {typeof count === "number" ? <Badge variant="outline">{count}</Badge> : null}
      </div>
      {children}
    </section>
  );
}

export function EmptyRoleState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
      {text}
    </div>
  );
}

export function OpenOrderButton({ orderId }: { orderId: string }) {
  return (
    <Button asChild size="sm" variant="outline">
      <Link href={`/orders/${orderId}`}>Открыть заказ</Link>
    </Button>
  );
}

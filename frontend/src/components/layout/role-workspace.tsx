"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { WorkMaterialItem, WorkOrderTask } from "@/services/http/work";
import { shortOrderNumber } from "@/lib/order-number";

export function parseMoney(value: string | number | null | undefined): number {
  const amount = typeof value === "string" ? Number.parseFloat(value) : value;
  return amount === null || amount === undefined || Number.isNaN(amount) ? 0 : amount;
}

export function formatMoney(value: string | number | null | undefined): string {
  return `${parseMoney(value).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} тг`;
}

export function formatMeters(value: string | number | null | undefined): string {
  const amount = parseMoney(value);
  return amount > 0 ? `${amount.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} м` : "не указано";
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "дата не указана";
  return new Date(value).toLocaleDateString("ru-RU");
}

export function WorkspaceHeader({
  title,
  description,
  onBack,
  children,
}: {
  title: string;
  description: string;
  onBack?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {onBack && (
        <button
          onClick={onBack}
          className="mb-3 flex items-center gap-1.5 text-[14px] text-[#475569] hover:text-[#0EA5E9] transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Назад
        </button>
      )}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm font-medium text-sky-700">Рабочий экран</div>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>
        </div>
        {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
      </div>
    </div>
  );
}

export function StatusPill({ label, tone = "slate" }: { label: string; tone?: "slate" | "sky" | "green" | "amber" | "red" }) {
  const toneClass = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
  }[tone];

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass}`}>{label}</span>;
}

export function StatusDot({ tone = "slate" }: { tone?: "slate" | "sky" | "green" | "amber" | "red" }) {
  const toneClass = {
    slate: "bg-slate-400",
    sky: "bg-sky-500",
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
  }[tone];

  return <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${toneClass}`} />;
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

export function OpenOrderButton({ orderId, view }: { orderId: string; view?: string }) {
  return (
    <Button asChild size="sm" variant="outline">
      <Link href={`/orders/${orderId}${view ? `?view=${view}` : ""}`}>Открыть заказ</Link>
    </Button>
  );
}

export function WorkOrderHeader({
  task,
  right,
  dotTone = "sky",
}: {
  task: WorkOrderTask;
  right?: React.ReactNode;
  dotTone?: "slate" | "sky" | "green" | "amber" | "red";
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 gap-3">
        <StatusDot tone={dotTone} />
        <div className="min-w-0">
          <div className="text-base font-semibold text-slate-950">{shortOrderNumber(task.order_number) || "Заказ без номера"}</div>
          <div className="mt-1 text-sm text-slate-600">
            {task.customer_name || "Клиент не указан"}
            {task.customer_phone ? ` · ${task.customer_phone}` : ""}
          </div>
          <div className="mt-1 text-xs text-slate-500">Срок: {formatDate(task.planned_completion_date)}</div>
        </div>
      </div>
      {right || <StatusPill label={task.status_label} tone="sky" />}
    </div>
  );
}

export function MaterialsList({ items, emptyText = "Позиции заказа ещё не сформированы." }: { items: WorkMaterialItem[]; emptyText?: string }) {
  if (items.length === 0) {
    return <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">{emptyText}</div>;
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={item.id || `${item.room_name}-${item.window_name}-${index}`} className="rounded-xl bg-slate-50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium text-slate-900">
              {item.room_name || "Комната"} / {item.window_name || "Изделие"}
            </div>
            {item.width_cm && item.height_cm ? <StatusPill label={`${item.width_cm}×${item.height_cm} см`} /> : null}
          </div>
          <div className="mt-2 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
            <div>Шторы: {item.fabric_name || "не выбрано"} · {formatMeters(item.fabric_meters)}</div>
            <div>Тюль: {item.tulle_name || "не выбрано"} · {formatMeters(item.tulle_meters)}</div>
          </div>
          {item.notes ? <div className="mt-2 text-xs text-slate-500">Комментарий: {item.notes}</div> : null}
        </div>
      ))}
    </div>
  );
}

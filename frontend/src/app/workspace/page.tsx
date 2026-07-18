"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { useRole } from "@/hooks/useRole";
import { shortOrderNumber } from "@/lib/order-number";
import {
  useOwnerQueue,
  useDesignerQueue,
  useWarehouseQueue,
  useProductionQueue,
  useInstallationQueue,
} from "@/hooks/useWorkQueues";
import type {
  WorkOrderTask,
  WorkMaterialItem,
  InstallationTask,
  WarehouseTask,
  ProductionTask,
  DesignerTask,
} from "@/services/http/work";
import { formatAddress } from "@/utils/formatAddress";
import { getStatusHex } from "@/lib/status-colors";

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function checkOverdue(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

/* ------------------------------------------------------------------ */
/*  Shared status badge (status→color from our design tokens)          */
/* ------------------------------------------------------------------ */

function StatusChip({ status, label }: { status: string; label: string }) {
  const color = getStatusHex(status);
  return (
    <span
      style={{
        color,
        background: color + "18",
        border: `1px solid ${color}40`,
        borderRadius: 20,
        padding: "2px 10px",
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Pill badge (for photo/avr/mat status)                              */
/* ------------------------------------------------------------------ */

type PillTone = "ok" | "warn" | "err" | "gray" | "blue";

function Pill({ label, tone = "gray" }: { label: string; tone?: PillTone }) {
  const styles: Record<PillTone, React.CSSProperties> = {
    ok:   { background: "#DCFCE7", color: "#15803D", border: "1px solid #86EFAC" },
    warn: { background: "#FEF9C3", color: "#92400E", border: "1px solid #FDE68A" },
    err:  { background: "#FEE2E2", color: "#B91C1C", border: "1px solid #FECACA" },
    gray: { background: "#F1F5F9", color: "#475569", border: "1px solid #E2E8F0" },
    blue: { background: "#E0F2FE", color: "#0369A1", border: "1px solid #BAE6FD" },
  };
  return (
    <span style={{ ...styles[tone], borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 500 }}>
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Compact items list (room / fabric rows)                            */
/* ------------------------------------------------------------------ */

function ItemsList({ items }: { items: WorkMaterialItem[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-2 space-y-1 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] p-3">
      {items.map((item, i) => (
        <div key={i} className="text-[12px] text-[#475569]">
          <span className="font-medium text-[#0F172A]">
            {[item.room_name, item.window_name].filter(Boolean).join(" / ") || "—"}
          </span>
          {item.width_cm && ` · ${item.width_cm}×${item.height_cm}`}
          {item.fabric_name && (
            <div className="text-[#94A3B8]">Шторы: {item.fabric_name}{item.fabric_meters ? ` (${item.fabric_meters} м)` : ""}</div>
          )}
          {item.tulle_name && (
            <div className="text-[#94A3B8]">Тюль: {item.tulle_name}{item.tulle_meters ? ` (${item.tulle_meters} м)` : ""}</div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Work card — base card shared by all roles                          */
/* ------------------------------------------------------------------ */

function WorkCard({
  task,
  pills,
  items,
  actions,
}: {
  task: WorkOrderTask;
  pills?: React.ReactNode;
  items?: WorkMaterialItem[];
  actions?: React.ReactNode;
}) {
  const overdue = checkOverdue(task.planned_completion_date);
  const addr = formatAddress(task.installation_address);

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[15px] font-semibold text-[#0F172A]">
          {shortOrderNumber(task.order_number)}
        </span>
        <StatusChip status={task.status} label={task.status_label} />
      </div>

      {/* Customer */}
      <div className="text-[13px] text-[#475569]">
        {task.customer_name}
        {task.customer_phone && (
          <span className="text-[#94A3B8]"> · {task.customer_phone}</span>
        )}
      </div>

      {/* Deadline */}
      <div className="text-[12px] text-[#94A3B8]">
        Срок: {fmtDate(task.planned_completion_date)}
        {overdue && (
          <span className="text-[#DC2626] font-medium"> · Просрочен</span>
        )}
      </div>

      {/* Address */}
      {addr && (
        <div className="text-[12px] text-[#94A3B8]">Адрес: {addr}</div>
      )}

      {/* Materials / items list */}
      {items && items.length > 0 && <ItemsList items={items} />}

      {/* Pills row */}
      {pills && <div className="flex flex-wrap gap-2 pt-1">{pills}</div>}

      {/* Actions row */}
      <div className="flex flex-wrap gap-2 pt-1">
        {actions}
        <Link
          href={`/orders/${task.id}`}
          className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[13px] text-[#475569] hover:text-[#0EA5E9] hover:border-[#0EA5E9] transition-colors"
        >
          Открыть заказ
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Kanban column                                                       */
/* ------------------------------------------------------------------ */

function KanbanCol({
  title,
  color,
  count,
  children,
}: {
  title: string;
  color: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between mb-4">
        <span style={{ color }} className="text-[15px] font-semibold">
          {title}
        </span>
        <span className="text-[13px] text-[#94A3B8] bg-[#F1F5F9] rounded-full px-2 py-0.5">
          {count}
        </span>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function EmptyCol({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#E2E8F0] p-6 text-center text-[13px] text-[#94A3B8]">
      {text}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page header                                                         */
/* ------------------------------------------------------------------ */

function WorkspaceHeader({
  role: roleLabel,
  title,
  description,
}: {
  role: string;
  title: string;
  description: string;
}) {
  const router = useRouter();
  return (
    <div className="flex items-start gap-4 mb-6">
      <button
        onClick={() => router.back()}
        className="mt-1 rounded-lg border border-[#E2E8F0] p-[7px] text-[#475569] hover:text-[#0EA5E9] transition-colors"
      >
        <ArrowLeft size={16} />
      </button>
      <div>
        <div className="text-[11px] font-medium text-[#0EA5E9] uppercase tracking-widest mb-1">
          Рабочий экран · {roleLabel}
        </div>
        <h1 className="text-[24px] font-semibold text-[#0F172A]">{title}</h1>
        <p className="text-[13px] text-[#94A3B8] mt-0.5">{description}</p>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  INSTALLER workspace                                                 */
/* ================================================================== */

function InstallerWorkspace() {
  const { data, isLoading, error } = useInstallationQueue();

  if (isLoading) return <LoadingState message="Загрузка..." />;
  if (error || !data) return <ErrorState title="Ошибка загрузки" description={error?.message} />;

  function InstallerCard({ task }: { task: InstallationTask }) {
    const hasPhotos = (task.photo_report_count ?? 0) > 0;
    const hasAct = task.completion_act_status !== "missing";
    return (
      <WorkCard
        task={task}
        items={task.items_to_install}
        pills={
          <>
            <Pill
              label={hasPhotos ? `фото: ${task.photo_report_count}` : "фото нет"}
              tone={hasPhotos ? "ok" : "warn"}
            />
            <Pill
              label={hasAct ? "АВР создан" : "АВР нет"}
              tone={hasAct ? "ok" : "warn"}
            />
          </>
        }
        actions={
          task.status === "ready" ? (
            <Link
              href={`/orders/${task.id}`}
              className="rounded-lg bg-[#60CCED] px-4 py-1.5 text-[13px] text-white font-medium hover:bg-[#4DBCE0] transition-colors flex items-center gap-1.5"
            >
              Начать установку
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
      <WorkspaceHeader
        role="Установщик"
        title="Установка"
        description="Куда ехать, кому звонить, что установить и что закрыть после."
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-5">
        <KanbanCol title="Готово к выезду" color="#0EA5E9" count={data.ready_for_installation.length}>
          {data.ready_for_installation.length
            ? data.ready_for_installation.map((t) => <InstallerCard key={t.id} task={t} />)
            : <EmptyCol text="Нет заказов" />}
        </KanbanCol>
        <KanbanCol title="На установке" color="#4F46E5" count={data.in_installation.length}>
          {data.in_installation.length
            ? data.in_installation.map((t) => <InstallerCard key={t.id} task={t} />)
            : <EmptyCol text="Нет активных" />}
        </KanbanCol>
        <KanbanCol title="Нужны фото или АВР" color="#D97706" count={data.needs_photo_or_avr.length}>
          {data.needs_photo_or_avr.length
            ? data.needs_photo_or_avr.map((t) => <InstallerCard key={t.id} task={t} />)
            : <EmptyCol text="Всё закрыто" />}
        </KanbanCol>
        <KanbanCol title="После установки" color="#32ED51" count={data.waiting_final_payment.length}>
          {data.waiting_final_payment.length
            ? data.waiting_final_payment.map((t) => <InstallerCard key={t.id} task={t} />)
            : <EmptyCol text="Нет заказов" />}
        </KanbanCol>
      </div>
    </>
  );
}

/* ================================================================== */
/*  WAREHOUSE workspace                                                 */
/* ================================================================== */

function WarehouseWorkspace() {
  const { data, isLoading, error } = useWarehouseQueue();

  if (isLoading) return <LoadingState message="Загрузка..." />;
  if (error || !data) return <ErrorState title="Ошибка загрузки" description={error?.message} />;

  const readinessColor = (r: string) =>
    r === "ready" ? "#32ED51" : r === "partially_ready" ? "#EBDD1D" : "#DC2626";

  function WarehouseCard({ task }: { task: WarehouseTask }) {
    const color = readinessColor(task.material_readiness);
    return (
      <WorkCard
        task={task}
        items={task.selected_materials}
        pills={
          <Pill
            label={task.material_readiness_label || task.material_readiness}
            tone={
              task.material_readiness === "ready"
                ? "ok"
                : task.material_readiness === "partially_ready"
                ? "warn"
                : "err"
            }
          />
        }
      />
    );
  }

  return (
    <>
      <WorkspaceHeader
        role="Склад"
        title="Склад"
        description="Какие материалы нужны по заказам и что уже собрано."
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <KanbanCol title="Не готово" color="#DC2626" count={data.not_ready.length}>
          {data.not_ready.length
            ? data.not_ready.map((t) => <WarehouseCard key={t.id} task={t} />)
            : <EmptyCol text="Все материалы готовы" />}
        </KanbanCol>
        <KanbanCol title="Частично готово" color="#D97706" count={data.partially_ready.length}>
          {data.partially_ready.length
            ? data.partially_ready.map((t) => <WarehouseCard key={t.id} task={t} />)
            : <EmptyCol text="Нет частичных" />}
        </KanbanCol>
        <KanbanCol title="Материалы готовы" color="#32ED51" count={data.ready.length}>
          {data.ready.length
            ? data.ready.map((t) => <WarehouseCard key={t.id} task={t} />)
            : <EmptyCol text="Нет готовых" />}
        </KanbanCol>
      </div>
    </>
  );
}

/* ================================================================== */
/*  PRODUCTION workspace                                                */
/* ================================================================== */

function ProductionWorkspace() {
  const { data, isLoading, error } = useProductionQueue();

  if (isLoading) return <LoadingState message="Загрузка..." />;
  if (error || !data) return <ErrorState title="Ошибка загрузки" description={error?.message} />;

  const STAGE_LABELS: Record<string, string> = {
    not_started: "Не начато",
    cutting: "Раскрой",
    sewing: "Пошив",
    quality_check: "Контроль",
    done: "Готово",
  };

  function ProductionCard({ task }: { task: ProductionTask }) {
    return (
      <WorkCard
        task={task}
        items={task.items_to_sew}
        pills={
          <Pill
            label={task.production_stage_label || STAGE_LABELS[task.production_stage] || task.production_stage}
            tone={task.production_stage === "done" ? "ok" : "blue"}
          />
        }
      />
    );
  }

  return (
    <>
      <WorkspaceHeader
        role="Швея"
        title="Пошив"
        description="Что шить, в каком порядке и что уже готово."
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <KanbanCol title="Ожидает пошива" color="#0EA5E9" count={data.ready_to_start.length}>
          {data.ready_to_start.length
            ? data.ready_to_start.map((t) => <ProductionCard key={t.id} task={t} />)
            : <EmptyCol text="Нет заказов в очереди" />}
        </KanbanCol>
        <KanbanCol title="В пошиве" color="#7C3AED" count={data.in_sewing.length}>
          {data.in_sewing.length
            ? data.in_sewing.map((t) => <ProductionCard key={t.id} task={t} />)
            : <EmptyCol text="Нет активных" />}
        </KanbanCol>
        <KanbanCol title="Готово" color="#32ED51" count={data.done.length}>
          {data.done.length
            ? data.done.map((t) => <ProductionCard key={t.id} task={t} />)
            : <EmptyCol text="Нет готовых" />}
        </KanbanCol>
      </div>
    </>
  );
}

/* ================================================================== */
/*  DESIGNER workspace                                                  */
/* ================================================================== */

function DesignerWorkspace() {
  const { data, isLoading, error } = useDesignerQueue();

  if (isLoading) return <LoadingState message="Загрузка..." />;
  if (error || !data) return <ErrorState title="Ошибка загрузки" description={error?.message} />;

  function DesignerCard({ task }: { task: DesignerTask }) {
    return (
      <WorkCard
        task={task}
        actions={
          <>
            <Link
              href={task.measurements_url || `/measurements?order=${task.id}`}
              className="rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-1.5 text-[13px] text-[#475569] hover:text-[#0EA5E9] transition-colors"
            >
              Замер
            </Link>
            <Link
              href={task.estimate_url || `/estimate?order=${task.id}`}
              className="rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-1.5 text-[13px] text-[#475569] hover:text-[#0EA5E9] transition-colors"
            >
              КП
            </Link>
          </>
        }
      />
    );
  }

  return (
    <>
      <WorkspaceHeader
        role="Дизайнер"
        title="Дизайнер"
        description="Замеры, КП и согласование с клиентами."
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-5">
        <KanbanCol title="Нужен замер" color="#0EA5E9" count={data.needs_measurement.length}>
          {data.needs_measurement.length
            ? data.needs_measurement.map((t) => <DesignerCard key={t.id} task={t} />)
            : <EmptyCol text="Нет заказов" />}
        </KanbanCol>
        <KanbanCol title="Замер готов — нужно КП" color="#7C3AED" count={data.measurement_done_needs_quote.length}>
          {data.measurement_done_needs_quote.length
            ? data.measurement_done_needs_quote.map((t) => <DesignerCard key={t.id} task={t} />)
            : <EmptyCol text="Нет заказов" />}
        </KanbanCol>
        <KanbanCol title="КП в работе" color="#D97706" count={data.quote_in_progress.length}>
          {data.quote_in_progress.length
            ? data.quote_in_progress.map((t) => <DesignerCard key={t.id} task={t} />)
            : <EmptyCol text="Нет активных" />}
        </KanbanCol>
        <KanbanCol title="Просрочены" color="#DC2626" count={data.overdue.length}>
          {data.overdue.length
            ? data.overdue.map((t) => <DesignerCard key={t.id} task={t} />)
            : <EmptyCol text="Просрочен нет" />}
        </KanbanCol>
      </div>
    </>
  );
}

/* ================================================================== */
/*  OWNER workspace — all roles overview                               */
/* ================================================================== */

const OWNER_SECTIONS = [
  {
    key: "needs_measurement" as const,
    label: "Дизайнер — замеры",
    color: "#0EA5E9",
    empty: "Нет замеров",
  },
  {
    key: "needs_quote" as const,
    label: "Дизайнер — КП",
    color: "#7C3AED",
    empty: "Нет КП",
  },
  {
    key: "materials_not_ready" as const,
    label: "Склад — материалы",
    color: "#D97706",
    empty: "Все материалы готовы",
  },
  {
    key: "in_sewing" as const,
    label: "Пошив",
    color: "#7C3AED",
    empty: "Нет в пошиве",
  },
  {
    key: "on_installation" as const,
    label: "Установка",
    color: "#4F46E5",
    empty: "Нет на установке",
  },
  {
    key: "waiting_payment" as const,
    label: "Ожидание оплаты",
    color: "#EBDD1D",
    empty: "Нет ожидающих",
  },
  {
    key: "overdue" as const,
    label: "Просрочены",
    color: "#DC2626",
    empty: "Просроченных нет",
  },
] as const;

function CounterTile({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex-1 min-w-[100px] bg-white rounded-xl border border-[#E2E8F0] p-4 text-center">
      <div
        style={{ color, fontSize: 26, fontWeight: 500, lineHeight: 1.1 }}
      >
        {value}
      </div>
      <div className="text-[11px] text-[#94A3B8] mt-1 leading-tight">{label}</div>
    </div>
  );
}

function OwnerWorkspace() {
  const { data, isLoading, error } = useOwnerQueue();

  if (isLoading) return <LoadingState message="Загрузка..." />;
  if (error || !data) return <ErrorState title="Ошибка загрузки" description={error?.message} />;

  const c = data.counters;

  return (
    <>
      <WorkspaceHeader
        role="Владелец"
        title="Рабочий стол"
        description="Весь ход работ по ролям — одним взглядом."
      />

      {/* Counter tiles */}
      <div className="flex flex-wrap gap-3 mb-8">
        <CounterTile label="Новые" value={c.new_orders} color="#0EA5E9" />
        <CounterTile label="Нужен замер" value={c.needs_measurement} color="#0EA5E9" />
        <CounterTile label="Нужно КП" value={c.needs_quote} color="#7C3AED" />
        <CounterTile label="Материалы" value={c.materials_not_ready} color="#D97706" />
        <CounterTile label="В пошиве" value={c.in_sewing} color="#7C3AED" />
        <CounterTile label="Установка" value={c.on_installation} color="#4F46E5" />
        <CounterTile label="Ждут оплату" value={c.waiting_payment} color="#EBDD1D" />
        <CounterTile label="Просрочено" value={c.overdue} color="#DC2626" />
      </div>

      {/* Role sections */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {OWNER_SECTIONS.map((sec) => {
          const orders: WorkOrderTask[] = data[sec.key] || [];
          return (
            <div key={sec.key} className="bg-white rounded-xl border border-[#E2E8F0] p-5">
              <div className="flex items-center justify-between mb-4">
                <span style={{ color: sec.color }} className="text-[14px] font-semibold">
                  {sec.label}
                </span>
                <span className="text-[12px] text-[#94A3B8] bg-[#F1F5F9] rounded-full px-2 py-0.5">
                  {orders.length}
                </span>
              </div>
              {orders.length === 0 ? (
                <p className="text-[13px] text-[#94A3B8] italic">{sec.empty}</p>
              ) : (
                <div className="space-y-2">
                  {orders.map((task) => {
                    const overdue = checkOverdue(task.planned_completion_date);
                    return (
                      <div
                        key={task.id}
                        className="flex items-center justify-between rounded-lg border border-[#F1F5F9] bg-[#FAFBFC] px-3 py-2 hover:border-[#E2E8F0] transition-colors"
                      >
                        <div>
                          <span className="text-[13px] font-medium text-[#0F172A]">
                            {shortOrderNumber(task.order_number)}
                          </span>
                          <span className="text-[12px] text-[#94A3B8] ml-2">
                            {task.customer_name}
                          </span>
                          {overdue && (
                            <span className="text-[11px] text-[#DC2626] font-medium ml-1">
                              · Просрочен
                            </span>
                          )}
                        </div>
                        <Link
                          href={`/orders/${task.id}`}
                          className="text-[12px] text-[#0EA5E9] hover:underline whitespace-nowrap ml-3"
                        >
                          →
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ================================================================== */
/*  Main page — role dispatcher                                        */
/* ================================================================== */

export default function WorkspacePage() {
  const { role } = useRole();

  const content = () => {
    if (!role) return <LoadingState message="Определяем роль..." />;
    if (role === "owner" || role === "designer") {
      if (role === "owner") return <OwnerWorkspace />;
      return <DesignerWorkspace />;
    }
    if (role === "warehouse") return <WarehouseWorkspace />;
    if (role === "production") return <ProductionWorkspace />;
    if (role === "installation") return <InstallerWorkspace />;
    return (
      <div className="text-center py-16 text-[#94A3B8]">
        <p>Рабочий стол для вашей роли не настроен.</p>
        <Link href="/orders" className="text-[#0EA5E9] hover:underline mt-2 inline-block">
          Перейти к заказам →
        </Link>
      </div>
    );
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#F0F4F8] p-6">
        {content()}
      </div>
    </ProtectedRoute>
  );
}

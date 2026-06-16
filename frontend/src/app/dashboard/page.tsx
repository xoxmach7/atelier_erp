"use client";

import Link from "next/link";
import { BarChart2, TrendingDown, TrendingUp, RefreshCw } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/contexts/auth-context";
import { useRole } from "@/hooks/useRole";
import { ErrorState, LoadingState } from "@/components/shared";
import { useOwnerQueue, useDashboard } from "@/hooks/useWorkQueues";
import { useRouter } from "next/navigation";

// ─── helpers ──────────────────────────────────────────────────────────────────

const MONTHS: Record<string, string> = {
  "01": "Янв", "02": "Фев", "03": "Мар", "04": "Апр",
  "05": "Май", "06": "Июн", "07": "Июл", "08": "Авг",
  "09": "Сен", "10": "Окт", "11": "Ноя", "12": "Дек",
};
function monthLabel(m: string) {
  return MONTHS[m.slice(5, 7)] ?? m.slice(5);
}
function fmtAxis(v: number) {
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + "М";
  if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(0) + "к";
  return v.toFixed(0);
}
function startOfYear() {
  const d = new Date();
  return `01.01.${d.getFullYear()}`;
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────

function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const yLabels = [maxVal, maxVal * 0.75, maxVal * 0.5, maxVal * 0.25, 0].map(fmtAxis);

  return (
    <div className="flex gap-2 flex-1">
      <div className="flex flex-col w-10 shrink-0 pb-6">
        <span className="text-[10px] text-[#94A3B8] text-right leading-none mb-1.5">₸</span>
        <div className="flex flex-1 flex-col justify-between">
          {yLabels.map((label, i) => (
            <span key={i} className="text-[10px] text-[#94A3B8] text-right leading-none">
              {label}
            </span>
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-end gap-[6px] flex-1">
          {data.map((d, i) => {
            const pct = maxVal > 0 ? (d.value / maxVal) * 100 : 0;
            return (
              <div key={i} className="flex flex-1 flex-col items-center h-full justify-end">
                {pct > 0 && (
                  <div
                    className="w-full rounded-t-[4px] transition-all duration-300 bg-[#60CCED]"
                    style={{ height: `${pct}%` }}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex gap-[6px]">
          {data.map((d, i) => (
            <span key={i} className="flex-1 text-center text-[10px] text-[#94A3B8]">
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Chart Panel ──────────────────────────────────────────────────────────────

function ChartPanel({
  title,
  icon,
  data,
}: {
  title: string;
  icon: React.ReactNode;
  data: { label: string; value: number }[];
}) {
  return (
    <div className="flex-1 bg-white rounded-[7px] p-6 flex flex-col min-w-0 min-h-[300px]">
      <div className="flex items-center justify-center gap-2 mb-5">
        <span className="text-[#60CCED]">{icon}</span>
        <span className="text-[15px] font-semibold text-[#475569]">{title}</span>
      </div>
      <BarChart data={data} />
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  valueColor = "text-[#60CCED]",
  href,
}: {
  label: string;
  value: number;
  valueColor?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-1 flex-col items-center justify-center bg-white rounded-[12px] p-6 min-w-0 transition-colors hover:bg-[#F0F9FF]"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="absolute right-3 top-3 text-[#CBD5E1] group-hover:text-[#60CCED] transition-colors">
        <path d="M14 0 L0 0 L14 14 Z" fill="currentColor" />
      </svg>
      <span className="text-[14px] text-[#475569] leading-snug text-center group-hover:text-[#0284C7] transition-colors">
        {label}
      </span>
      <div className={`text-[52px] font-bold leading-none mt-3 text-center ${valueColor}`}>{value}</div>
    </Link>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

function DashboardContent() {
  const queue     = useOwnerQueue();
  const dashboard = useDashboard();
  const { logout, user } = useAuth();
  const { role } = useRole();
  const router = useRouter();

  // Дизайнер не видит дашборд — только заказы
  if (role === "designer") {
    router.replace("/orders");
    return null;
  }

  if (queue.isLoading || dashboard.isLoading)
    return <LoadingState message="Загрузка..." />;
  if (queue.isError || dashboard.isError)
    return (
      <ErrorState
        title="Не удалось загрузить дашборд"
        description={dashboard.error?.message ?? ""}
      />
    );

  const d        = dashboard.data;
  const orders   = d?.orders;
  const chart    = d?.chart ?? [];
  const counters = queue.data?.counters;

  const profitPoints  = chart.map((p) => ({ label: monthLabel(p.month), value: Math.max(p.paid - 0, 0) }));
  const revenuePoints = chart.map((p) => ({ label: monthLabel(p.month), value: p.revenue }));
  const expensePoints = chart.map((p) => ({ label: monthLabel(p.month), value: Math.max(p.revenue - p.paid, 0) }));

  // TODO: вернуть user?.tenant?.name, когда будут реальные организации клиентов
  const orgName = "Название организации";

  return (
    <div className="min-h-screen bg-[#FAFAFA] p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[32px] font-semibold text-[#0F172A]">{orgName}</h1>
          <div className="flex items-center gap-2 mt-1 text-[14px] text-[#475569]">
            <span>{startOfYear()} – н.в.</span>
            <button
              onClick={() => { queue.refetch?.(); dashboard.refetch?.(); }}
              className="text-[#94A3B8] hover:text-[#0EA5E9] transition-colors"
            >
              <RefreshCw size={20} />
            </button>
          </div>
        </div>
        <button
          onClick={() => logout()}
          className="text-[14px] text-[#475569] hover:text-[#DC2626] transition-colors mt-1"
        >
          Выйти из профиля
        </button>
      </div>

      {/* Charts Row */}
      <div className="flex gap-[38px] mb-[38px]">
        <ChartPanel title="Прибыль"  icon={<BarChart2 size={18} />}    data={profitPoints}  />
        <ChartPanel title="Выручка"  icon={<TrendingUp size={18} />}   data={revenuePoints} />
        <ChartPanel title="Расходы"  icon={<TrendingDown size={18} />} data={expensePoints} />
      </div>

      {/* Stat Cards */}
      <div className="flex gap-[38px]">
        <StatCard label="Все заказы (за период)" value={orders?.total ?? 0}                 href="/orders"         />
        <StatCard label="В работе"               value={orders?.in_work ?? 0}               href="/orders"         />
        <StatCard label="Ожидают оплаты"         value={orders?.awaiting_payment ?? 0}      href="/work/finance"   />
        <StatCard label="Просрочено"             value={orders?.overdue ?? 0}               href="/orders"         valueColor="text-[#DC2626]" />
        <StatCard label="Материал на исходе"     value={counters?.materials_not_ready ?? 0} href="/work/warehouse" valueColor="text-[#D97706]" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

"use client";

import Link from "next/link";
import { BarChart2, TrendingDown, TrendingUp, ChevronDown, RefreshCw } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/contexts/auth-context";
import { ErrorState, LoadingState } from "@/components/shared";
import { useOwnerQueue, useDashboard } from "@/hooks/useWorkQueues";

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

// ─── Mini Bar Chart ────────────────────────────────────────────────────────────

function MiniBarChart({ data }: { data: { label: string; value: number }[] }) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-[3px] h-[100px] flex-1">
      {data.map((d, i) => {
        const pct = Math.max((d.value / maxVal) * 100, 4);
        return (
          <div key={i} className="flex flex-1 flex-col items-center h-full justify-end">
            <div
              className={`w-full rounded-t-[3px] min-h-[3px] transition-all duration-300 ${
                d.value > 0 ? "bg-[#0EA5E9]" : "bg-[#E2E8F0]"
              }`}
              style={{ height: `${pct}%` }}
            />
          </div>
        );
      })}
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
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const yLabels = [maxVal, maxVal * 0.75, maxVal * 0.5, maxVal * 0.25, 0].map(fmtAxis);

  return (
    <div className="flex-1 p-5 min-w-0">
      <div className="flex items-center justify-center gap-1.5 mb-4">
        <span className="text-[#0EA5E9]">{icon}</span>
        <span className="text-sm font-semibold text-[#475569]">{title}</span>
      </div>
      <div className="flex gap-2">
        <div className="flex flex-col justify-between w-9 shrink-0 pb-5">
          {yLabels.map((label, i) => (
            <span key={i} className="text-[9px] text-[#94A3B8] text-right leading-none">
              {label}
            </span>
          ))}
        </div>
        <div className="flex-1 flex flex-col gap-1">
          <MiniBarChart data={data} />
          <div className="flex gap-[3px]">
            {data.map((d, i) => (
              <span key={i} className="flex-1 text-center text-[9px] text-[#94A3B8]">
                {d.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Nav Tile ─────────────────────────────────────────────────────────────────

function NavTile({
  label,
  value,
  valueColor = "text-[#0EA5E9]",
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
      className="group flex flex-1 flex-col gap-3 border-r border-[#E2E8F0] bg-[#F8FAFC] p-5 min-w-0 transition-colors hover:bg-[#F0F9FF] last:border-r-0"
    >
      <div className="flex items-start justify-between">
        <span className="text-[13px] text-[#475569] leading-snug pr-2 group-hover:text-[#0284C7] transition-colors">
          {label}
        </span>
        <span className="text-[#94A3B8] group-hover:text-[#0EA5E9] transition-colors">
          <ChevronDown size={14} />
        </span>
      </div>
      <div className={`text-4xl font-bold leading-none ${valueColor}`}>{value}</div>
    </Link>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

function DashboardContent() {
  const queue     = useOwnerQueue();
  const dashboard = useDashboard();
  const { logout, user } = useAuth();

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

  const revenuePoints = chart.map((p) => ({ label: monthLabel(p.month), value: p.revenue }));
  const paidPoints    = chart.map((p) => ({ label: monthLabel(p.month), value: p.paid    }));
  const debtPoints    = chart.map((p) => ({ label: monthLabel(p.month), value: Math.max(p.revenue - p.paid, 0) }));

  const displayName = user
    ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || user.username
    : "Организация";

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-8 pt-7 pb-2">
        <div>
          <h1 className="text-[28px] font-semibold text-[#0F172A]">{displayName}</h1>
          <div className="flex items-center gap-2 mt-1.5 text-sm text-[#475569]">
            <span>Дашборд</span>
            <button
              onClick={() => dashboard.refetch?.()}
              className="text-[#94A3B8] hover:text-[#0EA5E9] transition-colors"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
        <button
          onClick={() => logout()}
          className="text-sm text-[#475569] hover:text-[#DC2626] transition-colors mt-1"
        >
          Выйти
        </button>
      </div>

      {/* Charts Row */}
      <div className="flex border-b border-[#E2E8F0] mt-3">
        <ChartPanel title="Выручка"  icon={<BarChart2 size={16} />}    data={revenuePoints} />
        <div className="w-px bg-[#F1F5F9]" />
        <ChartPanel title="Оплачено" icon={<TrendingUp size={16} />}   data={paidPoints}    />
        <div className="w-px bg-[#F1F5F9]" />
        <ChartPanel title="Долг"     icon={<TrendingDown size={16} />} data={debtPoints}    />
      </div>

      {/* Nav Tiles */}
      <div className="flex">
        <NavTile label="Все заказы"        value={orders?.total ?? 0}                 href="/orders"         />
        <NavTile label="В работе"          value={orders?.in_work ?? 0}               href="/orders"         />
        <NavTile label="Ожидают оплаты"    value={orders?.awaiting_payment ?? 0}      href="/work/finance"   />
        <NavTile label="Просрочено"        value={orders?.overdue ?? 0}               href="/orders"         valueColor="text-[#DC2626]" />
        <NavTile label="Материал не готов" value={counters?.materials_not_ready ?? 0} href="/work/warehouse" valueColor="text-[#D97706]" />
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

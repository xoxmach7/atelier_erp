"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { TrendingDown, TrendingUp, RefreshCw, Tag } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/contexts/auth-context";
import { useRole } from "@/hooks/useRole";
import { ErrorState, LoadingState } from "@/components/shared";
import { useOwnerQueue, useDashboard } from "@/hooks/useWorkQueues";
import type { DesignerStat } from "@/services/http/work";
import { useRouter } from "next/navigation";

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

type ChartData = { label: string; value: number }[];

function BarChart({ data }: { data: ChartData }) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const yLabels = [maxVal, maxVal * 0.75, maxVal * 0.5, maxVal * 0.25, 0].map(fmtAxis);

  return (
    <div className="flex gap-2 flex-1">
      <div className="flex flex-col w-10 shrink-0 pb-6">
        <span className="text-[12px] text-[#94A3B8] text-right leading-none mb-1.5">₸</span>
        <div className="flex flex-1 flex-col justify-between">
          {yLabels.map((label, i) => (
            <span key={i} className="text-[12px] text-[#94A3B8] text-right leading-none">
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
                    className="w-full max-w-[42px] rounded-t-[4px] transition-all duration-300 bg-[#60CCED]"
                    style={{ height: `${pct}%` }}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex gap-[6px]">
          {data.map((d, i) => (
            <span key={i} className="flex-1 text-center text-[12px] text-[#94A3B8]">
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

type MetricKey = "profit" | "revenue" | "expense";

function MetricChart({
  profit,
  revenue,
  expense,
}: {
  profit: ChartData;
  revenue: ChartData;
  expense: ChartData;
}) {
  const [metric, setMetric] = useState<MetricKey>("profit");
  const conf: Record<MetricKey, { title: string; icon: React.ReactNode; data: ChartData }> = {
    profit: {
      title: "Прибыль",
      icon: <img src="/icons/profit.svg" width={22} height={22} alt="" />,
      data: profit,
    },
    revenue: { title: "Выручка", icon: <TrendingUp size={18} />, data: revenue },
    expense: { title: "Расходы", icon: <TrendingDown size={18} />, data: expense },
  };
  const order: MetricKey[] = ["profit", "revenue", "expense"];
  const active = conf[metric];

  return (
    <div className="flex-1 bg-white rounded-[7px] p-6 flex gap-4 min-w-0 min-h-[300px]">
      <div className="flex flex-col gap-2 justify-center shrink-0">
        {order.map((k) => (
          <button
            key={k}
            onClick={() => setMetric(k)}
            className={`px-3 py-1 rounded-full text-[10px] font-medium transition-colors ${
              metric === k
                ? "bg-[#EEF2F6] text-[#475569]"
                : "bg-[#60CCED] text-white hover:bg-[#4DBCE0]"
            }`}
          >
            {conf[k].title}
          </button>
        ))}
      </div>
      <div className="flex-1 flex flex-col min-w-0 max-w-[480px]">
        <div className="flex items-center justify-center gap-2 mb-5">
          <span className="text-[#60CCED] flex items-center">{active.icon}</span>
          <span className="text-[18px] font-semibold text-[#000000]">{active.title}</span>
        </div>
        <BarChart data={active.data} />
      </div>
    </div>
  );
}

function DesignersPanel({ designers }: { designers: DesignerStat[] }) {
  return (
    <div className="flex-1 bg-white rounded-[7px] p-6 flex flex-col min-w-0 min-h-[300px]">
      <div className="flex items-center justify-center gap-2 mb-5">
        <Tag size={22} className="text-[#60CCED]" />
        <span className="text-[18px] font-semibold text-[#000000]">Заказы (за период)</span>
      </div>
      {designers.length === 0 ? (
        <p className="text-[14px] text-[#94A3B8] text-center py-8">Дизайнеров пока нет</p>
      ) : (
        <table className="w-full table-fixed">
          <thead>
            <tr className="text-[14px] text-[#000000] border-b border-[#F1F5F9]">
              <th className="font-medium pb-3 text-left w-1/2">Дизайнер</th>
              <th className="font-medium pb-3 text-center w-1/4">Завершено</th>
              <th className="font-medium pb-3 text-center w-1/4">В работе</th>
            </tr>
          </thead>
          <tbody>
            {designers.map((d, i) => (
              <tr key={i} className="border-b border-[#F1F5F9] last:border-0">
                <td className="py-3 text-left text-[14px] text-[#000000]">{d.name}</td>
                <td className="py-3 text-center text-[32px] font-bold text-[#94A3B8]">{d.completed}</td>
                <td className="py-3 text-center text-[32px] font-bold text-[#60CCED]">{d.in_work}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

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

function DashboardContent() {
  const { role, isOwner } = useRole();
  const { logout } = useAuth();
  const router = useRouter();
  const queue = useOwnerQueue(isOwner);
  const dashboard = useDashboard(isOwner);

  // Не-владельцы не видят дашборд — уводим на их рабочий экран
  const ROLE_LANDING: Record<string, string> = {
    designer: "/orders",
    warehouse: "/work/warehouse",
    production: "/work/production",
    installation: "/work/installation",
  };
  const landing = role ? ROLE_LANDING[role] : undefined;
  useEffect(() => {
    if (landing) router.replace(landing);
  }, [landing, router]);
  if (landing) return null;

  if (queue.isLoading || dashboard.isLoading)
    return <LoadingState message="Загрузка..." />;
  if (queue.isError || dashboard.isError)
    return (
      <ErrorState
        title="Не удалось загрузить дашборд"
        description={dashboard.error?.message ?? ""}
      />
    );

  const d = dashboard.data;
  const orders = d?.orders;
  const chart = d?.chart ?? [];
  const counters = queue.data?.counters;

  const profitPoints = chart.map((p) => ({ label: monthLabel(p.month), value: Math.max(p.paid - 0, 0) }));
  const revenuePoints = chart.map((p) => ({ label: monthLabel(p.month), value: p.revenue }));
  const expensePoints = chart.map((p) => ({ label: monthLabel(p.month), value: Math.max(p.revenue - p.paid, 0) }));

  // TODO: вернуть user?.tenant?.name, когда будут реальные организации клиентов
  const orgName = "Название организации";

  return (
    <div className="bg-[#FAFAFA] p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[30px] font-semibold text-[#000000]">{orgName}</h1>
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

      {/* Chart + Designers */}
      <div className="flex gap-[38px] mb-[38px]">
        <MetricChart profit={profitPoints} revenue={revenuePoints} expense={expensePoints} />
        <DesignersPanel designers={d?.designers ?? []} />
      </div>

      {/* Stat Cards */}
      <div className="flex gap-[38px]">
        <StatCard label="Все заказы (за период)" value={orders?.total ?? 0}                 href="/orders"         />
        <StatCard label="В работе"               value={orders?.in_work ?? 0}               href="/orders"         />
        <StatCard label="Ожидают оплаты"         value={orders?.awaiting_payment ?? 0}      href="/work/finance"   />
        <StatCard label="Просрочено"             value={orders?.overdue ?? 0}               href="/orders"         valueColor="text-[#DC2626]" />
        <StatCard label="Материалы на исходе"    value={counters?.materials_not_ready ?? 0} href="/work/warehouse" valueColor="text-[#D97706]" />
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

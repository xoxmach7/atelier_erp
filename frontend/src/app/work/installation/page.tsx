"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, LogOut } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useOrders } from "@/hooks/useOrders";
import { useAuth } from "@/contexts/auth-context";
import { shortOrderNumber } from "@/lib/order-number";

const STAGE: Record<string, { label: string; color: string }> = {
  pending:     { label: "Ожидает",     color: "#DC2626" },
  scheduled:   { label: "Запланирован", color: "#D97706" },
  in_progress: { label: "Установка",   color: "#D97706" },
  done:        { label: "Установлено", color: "#16A34A" },
};
function stageStatus(v?: string) {
  return STAGE[v ?? ""] ?? { label: "—", color: "#94A3B8" };
}

const FILTERS = [
  { key: "",            label: "Все" },
  { key: "pending",     label: "Ожидает" },
  { key: "in_progress", label: "Установка" },
  { key: "done",        label: "Установлено" },
] as const;

function InstallationOrdersContent() {
  const router = useRouter();
  const { logout } = useAuth();
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [stageFilter, setStageFilter] = useState<string>("");

  const { data, isLoading } = useOrders({ pageSize: 200, search: search || undefined });
  const all = data?.results ?? [];
  const orders = stageFilter ? all.filter((o) => o.handover_stage === stageFilter) : all;

  return (
    <div className="min-h-screen bg-[#F0F4F8]">
      <div className="bg-white rounded-xl shadow-sm">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 sm:px-[52px] py-5 sm:py-[30px]">
          <div className="flex items-center gap-4">
            <h1 className="text-[26px] font-semibold text-[#0F172A] whitespace-nowrap">Заказы</h1>
            <div className="flex items-center gap-10 ml-[48px]">
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={`text-[15px] transition-colors ${
                  showFilters || stageFilter ? "text-[#0EA5E9]" : "text-[#475569] hover:text-[#0EA5E9]"
                }`}
              >
                Фильтры
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2">
              <Search size={14} className="text-[#94A3B8]" />
              <input
                type="text"
                placeholder="Поиск по клиенту"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-none bg-transparent text-[14px] text-[#0F172A] outline-none w-[170px] placeholder:text-[#94A3B8]"
              />
            </div>
            <button
              onClick={() => logout()}
              title="Выйти"
              className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-[7px] text-[13px] text-[#475569] hover:text-[#DC2626] hover:border-[#DC2626] transition-colors"
            >
              <LogOut size={15} />
              Выйти
            </button>
          </div>
        </div>

        {/* Filter pills */}
        {showFilters && (
          <div className="px-4 sm:px-[52px] pb-4 flex gap-2 flex-wrap">
            {FILTERS.map((f) => {
              const active = stageFilter === f.key;
              const color = f.key ? stageStatus(f.key).color : "#0EA5E9";
              return (
                <button
                  key={f.key}
                  onClick={() => setStageFilter(f.key)}
                  className="px-4 py-1.5 rounded-full text-[12px] font-semibold transition-all"
                  style={{
                    background: active ? color + "14" : "transparent",
                    border: `1.5px solid ${active ? color : "#E2E8F0"}`,
                    color: active ? color : "#475569",
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#60CCED]">
                <th className="px-4 sm:px-[52px] py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">№</th>
                <th className="px-6 py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">Клиент</th>
                <th className="px-6 py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">Дата создания</th>
                <th className="px-6 py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">Дизайнер</th>
                <th className="px-6 py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">Статус</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="px-4 sm:px-[52px] py-10 text-center text-[#94A3B8]">Загрузка...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={5} className="px-4 sm:px-[52px] py-10 text-center text-[#94A3B8]">Заказы не найдены</td></tr>
              ) : (
                orders.map((order, i) => {
                  const st = stageStatus(order.handover_stage);
                  return (
                    <tr
                      key={order.id}
                      onClick={() => router.push(`/orders/${order.id}`)}
                      className="border-b border-dashed border-[#CBD5E1] cursor-pointer hover:bg-[#F8FAFC] transition-colors"
                    >
                      <td className="px-4 sm:px-[52px] py-4 font-medium text-[#0F172A] whitespace-nowrap">{shortOrderNumber(order.order_number) || i + 1}</td>
                      <td className="px-6 py-4 text-[14px] text-[#0F172A]">{order.customer_name || "—"}</td>
                      <td className="px-6 py-4 text-[14px] text-[#0F172A] whitespace-nowrap">
                        {order.created_at
                          ? new Date(order.created_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
                          : "—"}
                      </td>
                      <td className="px-6 py-4 text-[14px] text-[#0F172A]">{order.designer_name || "—"}</td>
                      <td className="px-6 py-4 font-medium whitespace-nowrap" style={{ color: st.color }}>
                        {st.label}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="border-t border-[#F1F5F9] px-4 sm:px-[52px] py-3 text-[13px] text-[#94A3B8]">
          Показано {orders.length} из {all.length} заказов
        </div>
      </div>
    </div>
  );
}

export default function InstallationWorkPage() {
  return (
    <ProtectedRoute>
      <InstallationOrdersContent />
    </ProtectedRoute>
  );
}

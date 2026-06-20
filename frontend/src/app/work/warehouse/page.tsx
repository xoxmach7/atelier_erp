"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, ArrowLeft, LogOut } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useOrders } from "@/hooks/useOrders";
import { useAuth } from "@/contexts/auth-context";

const MAT: Record<string, { label: string; color: string }> = {
  not_ready:       { label: "Нет на складе", color: "#DC2626" },
  partially_ready: { label: "В сборке",      color: "#D97706" },
  ready:           { label: "Собран",        color: "#16A34A" },
};
function matStatus(v?: string) {
  return MAT[v ?? ""] ?? { label: "—", color: "#94A3B8" };
}

const FILTERS = [
  { key: "",                label: "Все" },
  { key: "not_ready",       label: "Нет на складе" },
  { key: "partially_ready", label: "В сборке" },
  { key: "ready",           label: "Собран" },
] as const;

function WarehouseOrdersContent() {
  const router = useRouter();
  const { logout } = useAuth();
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [matFilter, setMatFilter] = useState<string>("");

  const { data, isLoading } = useOrders({ pageSize: 200, search: search || undefined });
  const all = data?.results ?? [];
  const orders = matFilter ? all.filter((o) => o.material_readiness === matFilter) : all;

  return (
    <div className="min-h-screen bg-[#F0F4F8]">
      <div className="bg-white rounded-xl shadow-sm">
        {/* Top bar */}
        <div className="flex items-center justify-between px-[52px] py-[30px]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-[#475569] hover:text-[#0EA5E9] transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-[26px] font-semibold text-[#0F172A] whitespace-nowrap">Заказы</h1>
            <div className="flex items-center gap-10 ml-[48px]">
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={`text-[15px] transition-colors ${
                  showFilters || matFilter ? "text-[#0EA5E9]" : "text-[#475569] hover:text-[#0EA5E9]"
                }`}
              >
                Фильтры
              </button>
              <Link
                href="/work/warehouse/materials"
                className="text-[15px] text-[#475569] hover:text-[#0EA5E9] transition-colors"
              >
                Материалы
              </Link>
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
          <div className="px-[52px] pb-4 flex gap-2 flex-wrap">
            {FILTERS.map((f) => {
              const active = matFilter === f.key;
              const color = f.key ? matStatus(f.key).color : "#0EA5E9";
              return (
                <button
                  key={f.key}
                  onClick={() => setMatFilter(f.key)}
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
                <th className="px-[52px] py-[30px] text-left text-[22px] font-medium text-white whitespace-nowrap">№</th>
                <th className="px-6 py-[30px] text-left text-[22px] font-medium text-white whitespace-nowrap">Клиент</th>
                <th className="px-6 py-[30px] text-left text-[22px] font-medium text-white whitespace-nowrap">Дата создания</th>
                <th className="px-6 py-[30px] text-left text-[22px] font-medium text-white whitespace-nowrap">Дизайнер</th>
                <th className="px-6 py-[30px] text-left text-[22px] font-medium text-white whitespace-nowrap">Статус</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="px-[52px] py-10 text-center text-[#94A3B8]">Загрузка...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={5} className="px-[52px] py-10 text-center text-[#94A3B8]">Заказы не найдены</td></tr>
              ) : (
                orders.map((order, i) => {
                  const st = matStatus(order.material_readiness);
                  return (
                    <tr
                      key={order.id}
                      onClick={() => router.push(`/orders/${order.id}`)}
                      className="border-b border-[#CBD5E1] cursor-pointer hover:bg-[#F8FAFC] transition-colors"
                    >
                      <td className="px-[52px] py-[30px] text-[22px] font-light text-[#000000] whitespace-nowrap">{order.order_number || i + 1}</td>
                      <td className="px-6 py-[30px] text-[22px] font-light text-[#000000]">{order.customer_name || "—"}</td>
                      <td className="px-6 py-[30px] text-[22px] font-light text-[#000000] whitespace-nowrap">
                        {order.created_at
                          ? new Date(order.created_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" })
                          : "—"}
                      </td>
                      <td className="px-6 py-[30px] text-[22px] font-light text-[#000000]">{order.designer_name || "—"}</td>
                      <td className="px-6 py-[30px] text-[22px] font-medium whitespace-nowrap" style={{ color: st.color }}>
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
        <div className="border-t border-[#F1F5F9] px-[52px] py-3 text-[13px] text-[#94A3B8]">
          Показано {orders.length} из {all.length} заказов
        </div>
      </div>
    </div>
  );
}

export default function WarehouseOrdersPage() {
  return (
    <ProtectedRoute>
      <WarehouseOrdersContent />
    </ProtectedRoute>
  );
}

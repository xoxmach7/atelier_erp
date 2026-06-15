"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, ChevronDown, LogOut, ArrowLeft } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useOrders } from "@/hooks/useOrders";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/contexts/auth-context";
import Link from "next/link";

// Simplified 4-state list status — mirrors v4 design
function getListStatus(status: string): "active" | "waiting" | "overdue" | "done" {
  if (status === "overdue") return "overdue";
  if (["completed", "cancelled"].includes(status)) return "done";
  if (["waiting_final_payment", "draft", "new"].includes(status)) return "waiting";
  return "active";
}

const LIST_STATUS_PILLS = [
  { key: "" as const,        label: "Все",         color: "#0EA5E9" },
  { key: "active" as const,  label: "В работе",    color: "#16A34A" },
  { key: "waiting" as const, label: "В ожидании",  color: "#D97706" },
  { key: "overdue" as const, label: "Просрочен",   color: "#DC2626" },
  { key: "done" as const,    label: "Завершён",    color: "#64748B" },
] as const;

// Укрупнённый статус для СПИСКА заказов (детальный — внутри заказа: история + блок роли)
const LIST_STATUS_DISPLAY: Record<"active" | "waiting" | "overdue" | "done", { label: string; color: string }> = {
  active:  { label: "В работе",   color: "#16A34A" },
  waiting: { label: "Ожидание",   color: "#EBDD1D" },
  overdue: { label: "Просрочено", color: "#DC2626" },
  done:    { label: "Завершён",   color: "#64748B" },
};

type ListStatusKey = "" | "active" | "waiting" | "overdue" | "done";

function OrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { role, isOwner } = useRole();
  const { logout } = useAuth();

  // Filters state
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [listStatusFilter, setListStatusFilter] = useState<ListStatusKey>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Build query options
  const queryOptions: Record<string, string | number | undefined> = {
    pageSize: 200,
    search: search || undefined,
  };

  // customer filter from URL (?customer=id)
  const customerIdFromUrl = searchParams.get("customer");

  const { data, isLoading } = useOrders(queryOptions);
  const allOrders = data?.results ?? [];

  // Workers don't see completed/cancelled orders
  const isWorker = !isOwner && role !== "designer" && role !== "none";
  const showFinancial = isOwner;
  const canCreateOrder = isOwner || role === "designer";

  // Client-side filters
  const filtered = allOrders.filter((o) => {
    // hide in_production from list always
    if (o.status === "in_production") return false;
    // workers: hide completed/cancelled
    if (isWorker && ["completed", "cancelled"].includes(o.status)) return false;

    // Customer filter from URL
    if (customerIdFromUrl && o.customer !== customerIdFromUrl) return false;

    // List status pill filter
    if (listStatusFilter && getListStatus(o.status) !== listStatusFilter) return false;

    // Date range filter
    if (dateFrom && o.created_at) {
      if (o.created_at.slice(0, 10) < dateFrom) return false;
    }
    if (dateTo && o.created_at) {
      if (o.created_at.slice(0, 10) > dateTo) return false;
    }

    return true;
  });

  // Counts per list status (from base-filtered orders, before pill filter)
  const baseOrders = allOrders.filter((o) => {
    if (o.status === "in_production") return false;
    if (isWorker && ["completed", "cancelled"].includes(o.status)) return false;
    if (customerIdFromUrl && o.customer !== customerIdFromUrl) return false;
    return true;
  });

  function countByLS(ls: Exclude<ListStatusKey, "">) {
    return baseOrders.filter((o) => getListStatus(o.status) === ls).length;
  }

  const hasActiveFilters = !!listStatusFilter || !!dateFrom || !!dateTo;

  function clearFilters() {
    setListStatusFilter("");
    setDateFrom("");
    setDateTo("");
  }

  // colSpan depends on columns shown
  const colCount = showFinancial ? 6 : 5;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#F0F4F8]">
        <div className="bg-white rounded-xl shadow-sm">
          {/* Top bar */}
          <div className="flex items-center justify-between px-[52px] py-[30px]">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="text-[#475569] hover:text-[#0EA5E9] transition-colors"
              >
                <ArrowLeft size={24} />
              </button>
              <h1 className="text-[26px] font-semibold text-[#0F172A] whitespace-nowrap">
                Управление заказами
              </h1>
              <div className="flex items-center gap-10 ml-[48px]">
                {canCreateOrder && (
                  <button
                    onClick={() => router.push("/orders/new")}
                    className="text-[15px] text-[#475569] hover:text-[#0EA5E9] transition-colors"
                  >
                    Добавить заказ
                  </button>
                )}
                <button
                  onClick={() => setShowFilters((v) => !v)}
                  className={`flex items-center gap-1.5 text-[15px] transition-colors ${
                    showFilters || hasActiveFilters
                      ? "text-[#0EA5E9]"
                      : "text-[#475569] hover:text-[#0EA5E9]"
                  }`}
                >
                  Фильтры
                  {hasActiveFilters && (
                    <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#0EA5E9] text-[11px] font-medium text-white">
                      {[listStatusFilter, dateFrom, dateTo].filter(Boolean).length}
                    </span>
                  )}
                </button>
                {canCreateOrder && (
                  <Link
                    href="/customers"
                    className="flex items-center gap-1.5 text-[15px] text-[#475569] hover:text-[#0EA5E9] transition-colors"
                  >
                    Клиенты
                  </Link>
                )}
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

          {/* Status pills — показываются только при открытых Фильтрах */}
          {showFilters && (
          <div className="px-[52px] pb-4 flex gap-2 flex-wrap">
            {LIST_STATUS_PILLS.filter((p) => isOwner || role === "designer" || p.key !== "done").map((pill) => {
              const active = listStatusFilter === pill.key;
              const count = pill.key === "" ? baseOrders.length : countByLS(pill.key);
              return (
                <button
                  key={pill.key}
                  onClick={() => setListStatusFilter(pill.key)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-semibold transition-all"
                  style={{
                    background: active ? pill.color + "14" : "transparent",
                    border: `1.5px solid ${active ? pill.color : "#E2E8F0"}`,
                    color: active ? pill.color : "#475569",
                  }}
                >
                  {pill.key && (
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: active ? pill.color : "#94A3B8" }}
                    />
                  )}
                  {pill.label}
                  <span className="opacity-60">{count}</span>
                </button>
              );
            })}
          </div>
          )}

          {/* Filters panel */}
          {showFilters && (
            <div className="border-t border-[#F1F5F9] px-[52px] py-4">
              <div className="flex items-end gap-6 flex-wrap">
                {/* Date from */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium text-[#94A3B8] uppercase tracking-wider">
                    Дата от
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[14px] text-[#0F172A] outline-none focus:border-[#0EA5E9] transition-colors"
                  />
                </div>

                {/* Date to */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium text-[#94A3B8] uppercase tracking-wider">
                    Дата до
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[14px] text-[#0F172A] outline-none focus:border-[#0EA5E9] transition-colors"
                  />
                </div>

                {/* Clear filters */}
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 rounded-lg px-3 py-2 text-[13px] text-[#DC2626] hover:bg-[#FEE2E2] transition-colors"
                  >
                    <X size={14} />
                    Сбросить
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Customer filter banner */}
          {customerIdFromUrl && (
            <div className="border-t border-[#F1F5F9] px-[52px] py-3 flex items-center gap-3 bg-[#E0F2FE]">
              
              <span className="text-[13px] text-[#0F172A]">
                Показаны заказы выбранного клиента
              </span>
              <button
                onClick={() => router.push("/orders")}
                className="ml-2 text-[13px] text-[#0EA5E9] hover:underline"
              >
                Показать все
              </button>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#60CCED]">
                  <th className="px-[52px] py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">№</th>
                  <th className="px-6 py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">Клиент</th>
                  <th className="px-6 py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">Дата создания</th>
                  <th className="px-6 py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">Дизайнер</th>
                  {showFinancial && (
                    <th className="px-6 py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">Сумма</th>
                  )}
                  <th className="px-6 py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">Статус</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={colCount} className="px-[52px] py-10 text-center text-[#94A3B8]">
                      Загрузка...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={colCount} className="px-[52px] py-10 text-center text-[#94A3B8]">
                      Заказы не найдены
                    </td>
                  </tr>
                ) : (
                  filtered.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => router.push(`/orders/${order.id}`)}
                      className="border-b border-dashed border-[#CBD5E1] cursor-pointer hover:bg-[#F8FAFC] transition-colors"
                    >
                      <td className="px-[52px] py-4 font-medium text-[#0F172A] whitespace-nowrap">
                        {order.order_number || order.id}
                      </td>
                      <td className="px-6 py-4 text-[#0F172A]">
                        <div>{order.customer_name || "—"}</div>
                      </td>
                      <td className="px-6 py-4 text-[#0F172A] whitespace-nowrap">
                        {order.created_at
                          ? new Date(order.created_at).toLocaleDateString("ru-RU", {
                              day: "2-digit", month: "2-digit", year: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="px-6 py-4 text-[#0F172A]">
                        {order.designer_name || "—"}
                      </td>
                      {showFinancial && (
                        <td className="px-6 py-4 text-[#0F172A] whitespace-nowrap text-left">
                          {Number(order.total_amount) > 0
                            ? Number(order.total_amount).toLocaleString("ru-RU") + " ₸"
                            : "—"}
                        </td>
                      )}
                      <td className="px-6 py-4">
                        {(() => {
                          const d = LIST_STATUS_DISPLAY[getListStatus(order.status)];
                          return <span className="font-medium" style={{ color: d.color }}>{d.label}</span>;
                        })()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="border-t border-[#F1F5F9] px-[52px] py-3 text-[13px] text-[#94A3B8]">
            Показано {filtered.length} из {baseOrders.length} заказов
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F0F4F8] flex items-center justify-center"><div className="text-[#475569]">Загрузка...</div></div>}>
      <OrdersContent />
    </Suspense>
  );
}

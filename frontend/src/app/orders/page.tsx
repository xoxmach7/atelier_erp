"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, ArrowLeft, Filter, Users, X, ChevronDown } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { StatusText } from "@/components/shared/status-text";
import { useOrders } from "@/hooks/useOrders";
import Link from "next/link";

const STATUS_OPTIONS = [
  { value: "", label: "Все статусы" },
  { value: "new", label: "Новый" },
  { value: "in_work", label: "В работе" },
  { value: "ready", label: "Готов" },
  { value: "on_installation", label: "Установка" },
  { value: "waiting_final_payment", label: "Ожидание оплаты" },
  { value: "completed", label: "Завершён" },
  { value: "cancelled", label: "Отменён" },
] as const;

function OrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filters state
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Build query options
  const queryOptions: Record<string, string | number | undefined> = {
    pageSize: 200,
    search: search || undefined,
    status: statusFilter || undefined,
  };

  // customer filter from URL (?customer=id)
  const customerIdFromUrl = searchParams.get("customer");

  const { data, isLoading } = useOrders(queryOptions);
  const allOrders = data?.results ?? [];

  // Client-side filters: hide in_production, apply date range, apply customer
  const filtered = allOrders.filter((o) => {
    if (o.status === "in_production") return false;

    // Customer filter from URL
    if (customerIdFromUrl && o.customer !== customerIdFromUrl) return false;

    // Date range filter (client-side for now; can move to API params later)
    if (dateFrom && o.created_at) {
      const orderDate = o.created_at.slice(0, 10); // "YYYY-MM-DD"
      if (orderDate < dateFrom) return false;
    }
    if (dateTo && o.created_at) {
      const orderDate = o.created_at.slice(0, 10);
      if (orderDate > dateTo) return false;
    }

    return true;
  });

  const hasActiveFilters = statusFilter || dateFrom || dateTo;

  function clearFilters() {
    setStatusFilter("");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#F0F4F8]">
        <div className="bg-white rounded-xl shadow-sm">
          {/* Top bar */}
          <div className="flex items-center justify-between px-[52px] py-[30px]">
            <div className="flex items-center gap-[72px]">
              <h1 className="text-[26px] font-semibold text-[#0F172A] whitespace-nowrap">
                Управление заказами
              </h1>
              <div className="flex items-center gap-10">
                <button
                  onClick={() => router.push("/orders/new")}
                  className="text-[15px] text-[#475569] hover:text-[#0EA5E9] transition-colors"
                >
                  Добавить заказ
                </button>
                <button
                  onClick={() => setShowFilters((v) => !v)}
                  className={`flex items-center gap-1.5 text-[15px] transition-colors ${
                    showFilters || hasActiveFilters
                      ? "text-[#0EA5E9]"
                      : "text-[#475569] hover:text-[#0EA5E9]"
                  }`}
                >
                  <Filter size={15} />
                  Фильтры
                  {hasActiveFilters && (
                    <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#0EA5E9] text-[11px] font-medium text-white">
                      {[statusFilter, dateFrom, dateTo].filter(Boolean).length}
                    </span>
                  )}
                </button>
                <Link
                  href="/customers"
                  className="flex items-center gap-1.5 text-[15px] text-[#475569] hover:text-[#0EA5E9] transition-colors"
                >
                  <Users size={15} />
                  Клиенты
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
                onClick={() => router.push("/dashboard")}
                className="rounded-lg border border-[#E2E8F0] p-[7px] text-[#475569] hover:text-[#0EA5E9] transition-colors"
                title="На главную"
              >
                <ArrowLeft size={16} />
              </button>
            </div>
          </div>

          {/* Filters panel */}
          {showFilters && (
            <div className="border-t border-[#F1F5F9] px-[52px] py-4">
              <div className="flex items-end gap-6 flex-wrap">
                {/* Status */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium text-[#94A3B8] uppercase tracking-wider">
                    Статус
                  </label>
                  <div className="relative">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="appearance-none rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 pr-8 text-[14px] text-[#0F172A] outline-none focus:border-[#0EA5E9] transition-colors w-[200px]"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]"
                    />
                  </div>
                </div>

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
              <Users size={14} className="text-[#0EA5E9]" />
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
                <tr className="bg-[#0EA5E9]">
                  <th className="px-[52px] py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">№</th>
                  <th className="px-6 py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">Клиент</th>
                  <th className="px-6 py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">Дата создания</th>
                  <th className="px-6 py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">Дизайнер</th>
                  <th className="px-6 py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">Сумма</th>
                  <th className="px-6 py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">Статус</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-[52px] py-10 text-center text-[#94A3B8]">
                      Загрузка...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-[52px] py-10 text-center text-[#94A3B8]">
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
                        {order.customer_name || "—"}
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
                      <td className="px-6 py-4 text-[#0F172A] whitespace-nowrap">
                        {order.total_amount
                          ? Number(order.total_amount).toLocaleString("ru-RU") + " ₸"
                          : "—"}
                      </td>
                      <td className="px-6 py-4">
                        <StatusText status={order.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="border-t border-[#F1F5F9] px-[52px] py-3 text-[13px] text-[#94A3B8]">
            Показано {filtered.length} из {allOrders.length} заказов
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

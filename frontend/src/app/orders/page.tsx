"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowLeft, Plus } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { StatusText } from "@/components/shared/status-text";
import { useOrders } from "@/hooks/useOrders";

export default function OrdersPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useOrders({ pageSize: 200 });
  const orders = data?.results ?? [];

  const filtered = orders.filter((o) =>
    (o.customer_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (o.order_number || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ProtectedRoute>
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-8 py-6 flex-wrap gap-3">
          <div className="flex items-center gap-6 flex-wrap">
            <h1 className="text-[26px] font-semibold text-[#0F172A]">
              Управление заказами
            </h1>
            <div className="flex gap-4">
              <button
                onClick={() => router.push("/orders/new")}
                className="flex items-center gap-1.5 text-sm text-[#475569] hover:text-[#0EA5E9] transition-colors"
              >
                <Plus size={14} />
                Добавить заказ
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-[7px]">
              <Search size={14} className="text-[#94A3B8]" />
              <input
                type="text"
                placeholder="Поиск по клиенту или №"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-none bg-transparent text-[13px] text-[#0F172A] outline-none w-[160px] placeholder:text-[#94A3B8]"
              />
            </div>
            {/* Back to dashboard */}
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-lg border border-[#E2E8F0] p-[7px] text-[#475569] hover:text-[#0EA5E9] transition-colors"
              title="На главную"
            >
              <ArrowLeft size={16} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#60CCED]">
                <th className="px-5 py-3 text-left text-[13px] font-medium text-white whitespace-nowrap">№</th>
                <th className="px-5 py-3 text-left text-[13px] font-medium text-white whitespace-nowrap">Клиент</th>
                <th className="px-5 py-3 text-left text-[13px] font-medium text-white whitespace-nowrap">Дата создания</th>
                <th className="px-5 py-3 text-left text-[13px] font-medium text-white whitespace-nowrap">Сумма</th>
                <th className="px-5 py-3 text-left text-[13px] font-medium text-white whitespace-nowrap">Статус</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-[#94A3B8]">
                    Загрузка...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-[#94A3B8]">
                    Заказы не найдены
                  </td>
                </tr>
              ) : (
                filtered.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => router.push(`/orders/${order.id}`)}
                    className="border-b border-[#F1F5F9] cursor-pointer transition-colors hover:bg-[#F8FAFC]"
                  >
                    <td className="px-5 py-3.5 font-medium text-[#0F172A] whitespace-nowrap">
                      {order.order_number || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-[#0F172A]">
                      {order.customer_name || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-[#0F172A] whitespace-nowrap">
                      {order.created_at
                        ? new Date(order.created_at).toLocaleDateString("ru-RU")
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-[#0F172A] whitespace-nowrap">
                      {order.total_amount
                        ? Number(order.total_amount).toLocaleString("ru-RU") + " ₸"
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusText status={order.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="border-t border-[#F1F5F9] px-8 py-3 text-[13px] text-[#94A3B8]">
          Показано {filtered.length} из {orders.length} заказов
        </div>
      </div>
    </ProtectedRoute>
  );
}

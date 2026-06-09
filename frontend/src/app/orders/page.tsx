"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowLeft } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { StatusText } from "@/components/shared/status-text";
import { useOrders } from "@/hooks/useOrders";

export default function OrdersPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useOrders({ pageSize: 200 });
  const orders = data?.results ?? [];

  const filtered = orders.filter((o) => {
    if (o.status === "in_production") return false;
    return (
      (o.customer_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (o.order_number || "").toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#F0F4F8]">
        <div className="bg-white">
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
                <button className="text-[15px] text-[#475569] hover:text-[#0EA5E9] transition-colors">
                  Фильтры
                </button>
                <button className="text-[15px] text-[#475569] hover:text-[#0EA5E9] transition-colors">
                  Клиенты
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
            Показано {filtered.length} из {orders.length} заказов
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowLeft, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { fetchFabrics } from "@/services/http/fabrics";

const LOW_STOCK = 20; // м — порог «На исходе»

function fmtNum(v: string | number) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (Number.isNaN(n)) return "—";
  return Math.round(n).toLocaleString("ru-RU");
}

function MaterialsContent() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["inventory", "fabrics", search],
    queryFn: () => fetchFabrics({ search: search || undefined, page_size: 200, is_active: true }),
    staleTime: 30 * 1000,
  });
  const all = data?.results ?? [];
  const items = lowOnly ? all.filter((f) => parseFloat(f.available_meters) < LOW_STOCK) : all;

  return (
    <div className="min-h-screen bg-[#F0F4F8]">
      <div className="bg-white rounded-xl shadow-sm">
        {/* Top bar */}
        <div className="flex items-center justify-between px-[52px] py-[30px]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/work/warehouse")}
              className="text-[#475569] hover:text-[#0EA5E9] transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-[26px] font-semibold text-[#0F172A] whitespace-nowrap">Материалы</h1>
            <div className="flex items-center gap-10 ml-[48px]">
              <button
                onClick={() => alert("Добавление материала — скоро")}
                className="flex items-center gap-1.5 text-[15px] text-[#475569] hover:text-[#0EA5E9] transition-colors"
              >
                <Plus size={16} /> Добавить позицию
              </button>
              <button
                onClick={() => setLowOnly((v) => !v)}
                className={`text-[15px] transition-colors ${
                  lowOnly ? "text-[#0EA5E9]" : "text-[#475569] hover:text-[#0EA5E9]"
                }`}
              >
                Фильтры
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2">
            <Search size={14} className="text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Поиск по артикулу/наименованию"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-none bg-transparent text-[14px] text-[#0F172A] outline-none w-[260px] placeholder:text-[#94A3B8]"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#60CCED]">
                <th className="px-[52px] py-[30px] text-left text-[22px] font-medium text-white whitespace-nowrap">Артикул</th>
                <th className="px-6 py-[30px] text-left text-[22px] font-medium text-white whitespace-nowrap">Наименование</th>
                <th className="px-6 py-[30px] text-left text-[22px] font-medium text-white whitespace-nowrap">Стоимость за м/шт., ₸</th>
                <th className="px-6 py-[30px] text-left text-[22px] font-medium text-white whitespace-nowrap">Свободно</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className="px-[52px] py-10 text-center text-[#94A3B8]">Загрузка...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={4} className="px-[52px] py-10 text-center text-[#94A3B8]">Материалы не найдены</td></tr>
              ) : (
                items.map((f, i) => {
                  const avail = parseFloat(f.available_meters);
                  const low = avail < LOW_STOCK;
                  return (
                    <tr key={f.id} className="border-b border-[#CBD5E1]">
                      <td className="px-[52px] py-[30px] text-[22px] font-light text-[#000000] whitespace-nowrap">{f.hanger_number || i + 1}</td>
                      <td className="px-6 py-[30px] text-[22px] font-light text-[#000000]">{f.name}</td>
                      <td className="px-6 py-[30px] text-[22px] font-light text-[#000000] whitespace-nowrap">{fmtNum(f.price_per_meter)}</td>
                      <td className="px-6 py-[30px] text-[22px] font-light text-[#000000] whitespace-nowrap">
                        <span className={low ? "text-[#D97706]" : ""}>{fmtNum(f.available_meters)} м</span>
                        {low && <span className="ml-3 text-[18px] font-medium text-[#D97706]">(На исходе)</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-[#F1F5F9] px-[52px] py-3 text-[13px] text-[#94A3B8]">
          Показано {items.length} из {all.length} материалов
        </div>
      </div>
    </div>
  );
}

export default function MaterialsPage() {
  return (
    <ProtectedRoute>
      <MaterialsContent />
    </ProtectedRoute>
  );
}

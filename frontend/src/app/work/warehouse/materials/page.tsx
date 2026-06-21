"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowLeft, Plus, Loader2, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { fetchFabrics } from "@/services/http/fabrics";
import {
  fetchInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
} from "@/services/http/inventory-items";
import type { InventoryCategory, InventoryUnit, InventoryItemDTO, InventoryItemCreateInput } from "@/types";

const LOW_STOCK = 20; // м — порог «На исходе» для тканей

const CATEGORIES: { value: InventoryCategory; label: string }[] = [
  { value: "fabric", label: "Ткань" },
  { value: "tulle", label: "Тюль" },
  { value: "cornice", label: "Карниз" },
  { value: "accessory", label: "Фурнитура" },
  { value: "other", label: "Прочее" },
];

const UNITS: { value: InventoryUnit; label: string }[] = [
  { value: "m", label: "м" },
  { value: "pcs", label: "шт" },
  { value: "pack", label: "упак" },
];

function fmtNum(v: string | number) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (Number.isNaN(n)) return "—";
  return Math.round(n).toLocaleString("ru-RU");
}

type Row = {
  id: string;
  source: "fabric" | "item";
  rawId?: string; // id позиции InventoryItem (без префикса) — для редактирования
  sku: string;
  name: string;
  category: string;
  price: string;
  available: number;
  unit: string;
  low: boolean;
};

const EMPTY_FORM = {
  name: "",
  category: "accessory" as InventoryCategory,
  unit: "pcs" as InventoryUnit,
  quantity: "",
  price_per_unit: "",
  low_stock_threshold: "",
  sku: "",
  supplier: "",
};

function MaterialsContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState("");

  const { data: fabricsData, isLoading: fabricsLoading } = useQuery({
    queryKey: ["inventory", "fabrics", search],
    queryFn: () => fetchFabrics({ search: search || undefined, page_size: 200, is_active: true }),
    staleTime: 30 * 1000,
  });

  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ["inventory", "items", search],
    queryFn: () => fetchInventoryItems({ search: search || undefined, page_size: 200, is_active: true }),
    staleTime: 30 * 1000,
  });

  const itemsById = new Map<string, InventoryItemDTO>(
    (itemsData?.results ?? []).map((it) => [it.id, it]),
  );

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormError("");
  };

  const onMutationSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["inventory", "items"] });
    closeModal();
  };
  const onMutationError = (e: unknown) =>
    setFormError(e instanceof Error ? e.message : "Не удалось сохранить");

  const createMutation = useMutation({
    mutationFn: createInventoryItem,
    onSuccess: onMutationSuccess,
    onError: onMutationError,
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<InventoryItemCreateInput> }) =>
      updateInventoryItem(id, payload),
    onSuccess: onMutationSuccess,
    onError: onMutationError,
  });
  const deleteMutation = useMutation({
    mutationFn: deleteInventoryItem,
    onSuccess: onMutationSuccess,
    onError: onMutationError,
  });

  const saving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const openAdd = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (it: InventoryItemDTO) => {
    setForm({
      name: it.name,
      category: it.category,
      unit: it.unit,
      quantity: it.quantity,
      price_per_unit: it.price_per_unit,
      low_stock_threshold: it.low_stock_threshold,
      sku: it.sku,
      supplier: it.supplier,
    });
    setEditingId(it.id);
    setFormError("");
    setModalOpen(true);
  };

  const fabricRows: Row[] = (fabricsData?.results ?? []).map((f) => {
    const avail = parseFloat(f.available_meters);
    return {
      id: `f-${f.id}`,
      source: "fabric",
      sku: f.hanger_number || "—",
      name: f.name,
      category: "Ткань",
      price: f.price_per_meter,
      available: Number.isNaN(avail) ? 0 : avail,
      unit: "м",
      low: avail < LOW_STOCK,
    };
  });

  const itemRows: Row[] = (itemsData?.results ?? []).map((it) => {
    const q = parseFloat(it.quantity);
    return {
      id: `i-${it.id}`,
      source: "item",
      rawId: it.id,
      sku: it.sku || "—",
      name: it.name,
      category: it.category_display,
      price: it.price_per_unit,
      available: Number.isNaN(q) ? 0 : q,
      unit: it.unit_display,
      low: it.is_low_stock,
    };
  });

  const all = [...fabricRows, ...itemRows];
  const rows = lowOnly ? all.filter((r) => r.low) : all;
  const isLoading = fabricsLoading || itemsLoading;

  const submitDisabled =
    saving || !form.name.trim() || form.quantity === "" || form.price_per_unit === "";

  const handleRowClick = (r: Row) => {
    if (r.source !== "item" || !r.rawId) return;
    const it = itemsById.get(r.rawId);
    if (it) openEdit(it);
  };

  const handleSubmit = () => {
    setFormError("");
    if (!form.name.trim()) return setFormError("Укажите наименование");
    if (form.quantity === "" || parseFloat(form.quantity) < 0) return setFormError("Некорректное количество");
    if (form.price_per_unit === "" || parseFloat(form.price_per_unit) < 0) return setFormError("Некорректная цена");
    const payload = {
      name: form.name.trim(),
      category: form.category,
      unit: form.unit,
      quantity: form.quantity,
      price_per_unit: form.price_per_unit,
      low_stock_threshold: form.low_stock_threshold || 0,
      sku: form.sku.trim() || undefined,
      supplier: form.supplier.trim() || undefined,
    };
    if (editingId) updateMutation.mutate({ id: editingId, payload });
    else createMutation.mutate(payload);
  };

  const handleDelete = () => {
    if (!editingId) return;
    deleteMutation.mutate(editingId);
  };

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
                onClick={openAdd}
                className="flex items-center gap-1.5 text-[15px] text-[#475569] hover:text-[#0EA5E9] transition-colors"
              >
                <Plus size={16} /> Добавить материал
              </button>
              <button
                onClick={() => setLowOnly((v) => !v)}
                className={`text-[15px] transition-colors ${
                  lowOnly ? "text-[#0EA5E9]" : "text-[#475569] hover:text-[#0EA5E9]"
                }`}
              >
                {lowOnly ? "Показать все" : "Только на исходе"}
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
                <th className="px-6 py-[30px] text-left text-[22px] font-medium text-white whitespace-nowrap">Категория</th>
                <th className="px-6 py-[30px] text-left text-[22px] font-medium text-white whitespace-nowrap">Стоимость за ед., ₸</th>
                <th className="px-6 py-[30px] text-left text-[22px] font-medium text-white whitespace-nowrap">Свободно</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="px-[52px] py-10 text-center text-[#94A3B8]">Загрузка...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-[52px] py-10 text-center text-[#94A3B8]">Материалы не найдены</td></tr>
              ) : (
                rows.map((r) => {
                  const editable = r.source === "item";
                  return (
                    <tr
                      key={r.id}
                      onClick={() => handleRowClick(r)}
                      className={`border-b border-[#CBD5E1] ${editable ? "cursor-pointer hover:bg-[#F8FAFC]" : ""}`}
                      title={editable ? "Нажмите, чтобы изменить" : ""}
                    >
                      <td className="px-[52px] py-[30px] text-[22px] font-light text-[#000000] whitespace-nowrap">{r.sku}</td>
                      <td className="px-6 py-[30px] text-[22px] font-light text-[#000000]">{r.name}</td>
                      <td className="px-6 py-[30px] text-[18px] font-light text-[#475569] whitespace-nowrap">{r.category}</td>
                      <td className="px-6 py-[30px] text-[22px] font-light text-[#000000] whitespace-nowrap">{fmtNum(r.price)}</td>
                      <td className="px-6 py-[30px] text-[22px] font-light text-[#000000] whitespace-nowrap">
                        <span className={r.low ? "text-[#D97706]" : ""}>{fmtNum(r.available)} {r.unit}</span>
                        {r.low && <span className="ml-3 text-[18px] font-medium text-[#D97706]">(На исходе)</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-[#F1F5F9] px-[52px] py-3 text-[13px] text-[#94A3B8]">
          Показано {rows.length} из {all.length} материалов
        </div>
      </div>

      {/* Add / edit material modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !saving && closeModal()}
        >
          <div
            className="w-full max-w-[520px] rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#F1F5F9] px-6 py-4">
              <h2 className="text-[18px] font-semibold text-[#0F172A]">
                {editingId ? "Редактировать материал" : "Добавить материал"}
              </h2>
              <button
                onClick={() => !saving && closeModal()}
                className="text-[#94A3B8] hover:text-[#475569]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1 block text-[13px] font-medium text-[#475569]">Наименование *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Напр. Крючки металлические"
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[14px] text-[#0F172A] outline-none focus:border-[#60CCED]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-[#475569]">Категория</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value as InventoryCategory })}
                    className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[14px] text-[#0F172A] outline-none focus:border-[#60CCED]"
                  >
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-[#475569]">Единица</label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value as InventoryUnit })}
                    className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[14px] text-[#0F172A] outline-none focus:border-[#60CCED]"
                  >
                    {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-[#475569]">Количество *</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    placeholder="0"
                    className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[14px] text-[#0F172A] outline-none focus:border-[#60CCED]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-[#475569]">Цена за ед., ₸ *</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={form.price_per_unit}
                    onChange={(e) => setForm({ ...form, price_per_unit: e.target.value })}
                    placeholder="0"
                    className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[14px] text-[#0F172A] outline-none focus:border-[#60CCED]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-[#475569]">Порог «на исходе»</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={form.low_stock_threshold}
                    onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
                    placeholder="0"
                    className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[14px] text-[#0F172A] outline-none focus:border-[#60CCED]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-[#475569]">Артикул</label>
                  <input
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    placeholder="необязательно"
                    className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[14px] text-[#0F172A] outline-none focus:border-[#60CCED]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[13px] font-medium text-[#475569]">Поставщик</label>
                <input
                  value={form.supplier}
                  onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                  placeholder="необязательно"
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[14px] text-[#0F172A] outline-none focus:border-[#60CCED]"
                />
              </div>

              {formError && <p className="text-[13px] text-[#DC2626]">{formError}</p>}
            </div>

            <div className="flex items-center justify-between border-t border-[#F1F5F9] px-6 py-4">
              <div>
                {editingId && (
                  <button
                    onClick={handleDelete}
                    disabled={saving}
                    className="text-[14px] text-[#DC2626] hover:underline disabled:opacity-50"
                  >
                    Удалить
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => !saving && closeModal()}
                  className="rounded-lg px-4 py-2 text-[14px] text-[#475569] hover:bg-[#F1F5F9]"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitDisabled}
                  className="flex items-center gap-2 rounded-lg bg-[#60CCED] px-5 py-2 text-[14px] font-medium text-white hover:bg-[#3FB8DE] disabled:opacity-50"
                >
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 size={16} className="animate-spin" />}
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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

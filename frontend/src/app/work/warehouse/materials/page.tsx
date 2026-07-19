"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, ArrowLeft, Plus, Loader2, X, HelpCircle, MoreVertical } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ModalCloseX } from "@/components/shared/modal-close";
import { fetchFabrics } from "@/services/http/fabrics";
import {
  fetchInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  addInventoryQuantity,
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
  // «•••» у строки. Меню рендерится порталом в document.body с
  // position:fixed по координатам кнопки — строка таблицы лежит внутри
  // overflow-x-auto, а тот неявно обрезает и вертикаль (CSS: overflow-x
  // отличный от visible вычисляет overflow-y в auto), поэтому обычный
  // position:absolute внутри <td> обрезался нижней границей контейнера.
  const [menu, setMenu] = useState<{ id: string; top: number; right: number } | null>(null);
  const [addQtyId, setAddQtyId] = useState<string | null>(null);
  const [addQtyValue, setAddQtyValue] = useState("");
  const [addQtyError, setAddQtyError] = useState("");

  // Меню в fixed-координатах не следует за скроллом — закрываем его, чтобы
  // не повисало оторванным от кнопки.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menu]);

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
  const addQtyMutation = useMutation({
    mutationFn: ({ item, delta }: { item: InventoryItemDTO; delta: number }) =>
      addInventoryQuantity(item, delta),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", "items"] });
      setAddQtyId(null);
      setAddQtyValue("");
      setAddQtyError("");
    },
    onError: (e: unknown) => setAddQtyError(e instanceof Error ? e.message : "Не удалось добавить"),
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
    saving || !form.sku.trim() || !form.name.trim() || !form.unit;

  const inputCls =
    "w-full rounded-[10px] bg-[#E9E9E9] px-4 py-[14px] text-[15px] text-[#0F172A] outline-none placeholder:text-[#94A3B8]";

  const handleRowClick = (r: Row) => {
    if (r.source !== "item" || !r.rawId) return;
    const it = itemsById.get(r.rawId);
    if (it) openEdit(it);
  };

  const handleSubmit = () => {
    setFormError("");
    if (!form.sku.trim()) return setFormError("Укажите артикул");
    if (!form.name.trim()) return setFormError("Укажите наименование");
    const payload = {
      name: form.name.trim(),
      category: form.category,
      unit: form.unit,
      quantity: form.quantity || "0",
      price_per_unit: form.price_per_unit || "0",
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

  // «•••»: те же три действия, что в мобильном меню (Добавить количество /
  // Редактировать / Удалить) — на вебе редактирование раньше открывалось
  // только кликом по строке, без явного меню, а «Добавить количество»
  // отдельным действием не было вовсе (только полная перезапись остатка
  // через форму редактирования).
  const handleMenuDelete = (it: InventoryItemDTO) => {
    setMenu(null);
    if (!confirm(`Удалить позицию «${it.name}»?`)) return;
    deleteMutation.mutate(it.id);
  };

  const openAddQty = (it: InventoryItemDTO) => {
    setMenu(null);
    setAddQtyError("");
    setAddQtyValue("");
    setAddQtyId(it.id);
  };

  const submitAddQty = () => {
    const it = addQtyId ? itemsById.get(addQtyId) : undefined;
    const delta = parseFloat(addQtyValue);
    if (!it) return;
    if (!addQtyValue || Number.isNaN(delta) || delta <= 0) {
      setAddQtyError("Введите количество больше нуля");
      return;
    }
    addQtyMutation.mutate({ item: it, delta });
  };

  return (
    <div className="min-h-screen bg-[#F0F4F8]">
      <div className="bg-white rounded-xl shadow-sm">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 sm:px-[52px] py-5 sm:py-[30px]">
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
                <Plus size={16} /> Добавить позицию
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
                <th className="px-[52px] py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">Артикул</th>
                <th className="px-6 py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">Наименование</th>
                <th className="px-6 py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">Категория</th>
                <th className="px-6 py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">Стоимость за ед., ₸</th>
                <th className="px-6 py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">Свободно</th>
                <th className="px-4 py-4 text-white w-12" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-[52px] py-10 text-center text-[#94A3B8]">Загрузка...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-[52px] py-10 text-center text-[#94A3B8]">Материалы не найдены</td></tr>
              ) : (
                rows.map((r) => {
                  const editable = r.source === "item";
                  const it = editable && r.rawId ? itemsById.get(r.rawId) : undefined;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => handleRowClick(r)}
                      className={`border-b border-dashed border-[#CBD5E1] ${editable ? "cursor-pointer hover:bg-[#F8FAFC]" : ""}`}
                      title={editable ? "Нажмите, чтобы изменить" : ""}
                    >
                      <td className="px-[52px] py-4 text-[14px] text-[#0F172A] whitespace-nowrap">{r.sku}</td>
                      <td className="px-6 py-4 text-[14px] text-[#0F172A]">{r.name}</td>
                      <td className="px-6 py-4 text-[14px] text-[#475569] whitespace-nowrap">{r.category}</td>
                      <td className="px-6 py-4 text-[14px] text-[#0F172A] whitespace-nowrap">{fmtNum(r.price)}</td>
                      <td className="px-6 py-4 text-[14px] text-[#0F172A] whitespace-nowrap">
                        <span className={r.low ? "text-[#D97706]" : ""}>{fmtNum(r.available)} {r.unit}</span>
                        {r.low && <span className="ml-2 text-[12px] font-medium text-[#D97706]">(На исходе)</span>}
                      </td>
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        {editable && it && (
                          <button
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setMenu((v) =>
                                v?.id === it.id
                                  ? null
                                  : { id: it.id, top: rect.bottom + 4, right: window.innerWidth - rect.right }
                              );
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#475569] transition-colors"
                            title="Действия"
                          >
                            <MoreVertical size={18} />
                          </button>
                        )}
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

      {/*
        Меню «•••» — портал в document.body поверх всего, а не абсолютное
        позиционирование внутри строки таблицы. Строка лежит в
        overflow-x-auto, который обрезает меню по нижнему краю контейнера
        (CSS: overflow-x ≠ visible вычисляет overflow-y в auto — обрезка была
        видна на скрине пользователя). position:fixed по координатам кнопки
        полностью выходит из-под клиппинга предков.
      */}
      {menu && typeof document !== "undefined" && createPortal(
        (() => {
          const it = itemsById.get(menu.id);
          if (!it) return null;
          return (
            <>
              <div className="fixed inset-0 z-[100]" onClick={() => setMenu(null)} />
              <div
                className="fixed z-[101] w-52 rounded-[10px] bg-white py-1.5 shadow-2xl border border-[#E2E8F0]"
                style={{ top: menu.top, right: menu.right }}
              >
                <button
                  onClick={() => openAddQty(it)}
                  className="w-full px-4 py-2.5 text-left text-[14px] text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
                >
                  Добавить количество
                </button>
                <button
                  onClick={() => { setMenu(null); openEdit(it); }}
                  className="w-full px-4 py-2.5 text-left text-[14px] text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
                >
                  Редактировать
                </button>
                <button
                  onClick={() => handleMenuDelete(it)}
                  className="w-full px-4 py-2.5 text-left text-[14px] text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
                >
                  Удалить
                </button>
              </div>
            </>
          );
        })(),
        document.body
      )}

      {/* Добавить количество (приход) */}
      {addQtyId && (() => {
        const it = itemsById.get(addQtyId);
        if (!it) return null;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: "rgba(15,23,42,.35)", backdropFilter: "blur(4px)" }}
            onClick={() => !addQtyMutation.isPending && setAddQtyId(null)}
          >
            <div
              className="relative w-full max-w-[380px] rounded-[14px] bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-1 text-[20px] font-semibold text-[#0F172A]">Добавить количество</h2>
              <p className="mb-5 text-[14px] text-[#94A3B8]">
                {it.name} · сейчас {fmtNum(it.quantity)} {it.unit_display}
              </p>
              <input
                type="number" min="0" step="0.01" autoFocus
                value={addQtyValue}
                onChange={(e) => setAddQtyValue(e.target.value)}
                placeholder="0"
                className={inputCls}
              />
              {addQtyError && <p className="mt-3 text-[13px] text-[#DC2626]">{addQtyError}</p>}
              <button
                onClick={submitAddQty}
                disabled={addQtyMutation.isPending}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#60CCED] py-[12px] text-[15px] font-semibold text-white transition-colors hover:bg-[#4DBCE0] disabled:opacity-50"
              >
                {addQtyMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                Добавить
              </button>
            </div>
          </div>
        );
      })()}

      {/* Create / edit inventory item modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(15,23,42,.35)", backdropFilter: "blur(4px)" }}
          onClick={() => !saving && closeModal()}
        >
          <div
            className="relative w-full max-w-[480px] rounded-[14px] bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <ModalCloseX onClose={() => !saving && closeModal()} />

            <div className="px-6 sm:px-[52px] pb-10 pt-[72px]">
              <h2 className="mb-8 text-[28px] font-semibold text-[#0F172A]">
                {editingId ? "Редактирование позиции" : "Создание позиции"}
              </h2>

              {/* 1. Артикул */}
              <div className="mb-6">
                <label className="block text-[15px] text-[#0F172A] mb-2">
                  1. Артикул <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  autoFocus
                  className={inputCls}
                />
              </div>

              {/* 2. Наименование */}
              <div className="mb-6">
                <label className="block text-[15px] text-[#0F172A] mb-2">
                  2. Наименование <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputCls}
                />
              </div>

              {/* 3. Категория */}
              <div className="mb-6">
                <label className="block text-[15px] text-[#0F172A] mb-2">
                  3. Категория <span className="text-[#DC2626]">*</span>
                </label>
                <div className="relative">
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value as InventoryCategory })}
                    className={`${inputCls} appearance-none pr-10`}
                  >
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  <svg
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#475569]"
                    width="14" height="14" viewBox="0 0 24 24" fill="currentColor"
                  >
                    <path d="M12 16 6 9h12z" />
                  </svg>
                </div>
              </div>

              {/* 4. Единица измерения */}
              <div className="mb-6">
                <label className="block text-[15px] text-[#0F172A] mb-2">
                  4. Единица измерения <span className="text-[#DC2626]">*</span>
                </label>
                <div className="relative">
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value as InventoryUnit })}
                    className={`${inputCls} appearance-none pr-10`}
                  >
                    {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                  <svg
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#475569]"
                    width="14" height="14" viewBox="0 0 24 24" fill="currentColor"
                  >
                    <path d="M12 16 6 9h12z" />
                  </svg>
                </div>
              </div>

              {/* 5. Стоимость */}
              <div className="mb-6">
                <label className="block text-[15px] text-[#0F172A] mb-2">5. Стоимость за м/шт.</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number" min="0" step="0.01"
                    value={form.price_per_unit}
                    onChange={(e) => setForm({ ...form, price_per_unit: e.target.value })}
                    placeholder="0"
                    className={`${inputCls} flex-1`}
                  />
                  <span className="text-[18px] text-[#475569] shrink-0">₸</span>
                </div>
              </div>

              {/* 6. Минимальный запас */}
              <div className="mb-8">
                <label className="flex items-center gap-2 text-[15px] text-[#0F172A] mb-2">
                  6. Минимальный запас
                  <span title="Если остаток опустится ниже этого значения, позиция подсветится как «на исходе»">
                    <HelpCircle size={16} className="text-[#94A3B8]" />
                  </span>
                </label>
                <input
                  type="number" min="0" step="0.01"
                  value={form.low_stock_threshold}
                  onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
                  placeholder="0"
                  className={inputCls}
                />
              </div>

              {formError && <p className="mb-4 text-[14px] text-[#DC2626]">{formError}</p>}

              <button
                onClick={handleSubmit}
                disabled={submitDisabled}
                className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#60CCED] py-[14px] text-[16px] font-semibold text-white transition-colors hover:bg-[#4DBCE0] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 size={16} className="animate-spin" />}
                {editingId ? "Сохранить" : "Создать"}
              </button>

              {editingId && (
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="mt-4 w-full text-center text-[14px] text-[#DC2626] hover:underline disabled:opacity-50"
                >
                  Удалить позицию
                </button>
              )}
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

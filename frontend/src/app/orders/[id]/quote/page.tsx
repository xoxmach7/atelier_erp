"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { LoadingState } from "@/components/shared/loading-state";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchQuotes,
  createQuote,
  generateQuotePdf,
  fetchMeasurements,
  type QuoteItemPayload,
  type QuoteDTO,
} from "@/services/http/orders";
import { useRole } from "@/hooks/useRole";
import { ArrowLeft, FileText, Loader2, Download, Plus, RefreshCw } from "lucide-react";

interface QuoteFormItem {
  room_name: string;
  window_name: string;
  window_width_cm: number;
  window_height_cm: number;
  fabric_meters: string;
  fabric_cost: string;
  tulle_meters: string;
  tulle_cost: string;
  sewing_cost: string;
  installation_price: string;
  accessories_cost: string;
  line_total: string;
}

function fmtMoney(v: string | number | undefined): string {
  if (v === undefined || v === null) return "-";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (Number.isNaN(n)) return "-";
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const inputCls =
  "w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] text-[#0F172A] focus:outline-none focus:border-[#60CCED]";
const labelCls = "block text-[13px] font-medium text-[#475569] mb-1.5";

function OrderQuoteContent() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  const queryClient = useQueryClient();
  const { role } = useRole();

  const [showForm, setShowForm] = useState(false);
  const [validUntil, setValidUntil] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [installationCost, setInstallationCost] = useState("");
  const [deliveryCost, setDeliveryCost] = useState("");
  const [prepaymentPercent, setPrepaymentPercent] = useState("50");
  const [formItems, setFormItems] = useState<QuoteFormItem[]>([]);

  const canEdit = role === "owner" || role === "designer";

  const { data: quotesData, isLoading, isError, error } = useQuery({
    queryKey: ["order-quotes", orderId],
    queryFn: () => fetchQuotes(orderId),
    enabled: !!orderId,
  });

  const { data: measurementsData } = useQuery({
    queryKey: ["order-measurements-for-quote", orderId],
    queryFn: () => fetchMeasurements(orderId),
    enabled: showForm && !!orderId,
  });

  const pdfMutation = useMutation({
    mutationFn: generateQuotePdf,
    onSuccess: (data) => {
      if (data.pdf_url) {
        const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
        const url = data.pdf_url.startsWith("http") ? data.pdf_url : `${baseUrl}${data.pdf_url}`;
        window.open(url, "_blank");
      }
      queryClient.invalidateQueries({ queryKey: ["order-quotes", orderId] });
    },
  });

  const createMutation = useMutation({
    mutationFn: createQuote,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["order-quotes", orderId] });
      setShowForm(false);
      // «Сформировать» → сразу генерим PDF для созданного/пересозданного КП
      if (data?.id) {
        pdfMutation.mutate(data.id);
      }
    },
  });

  // Создание КП с нуля — позиции тянем из замеров
  const initForm = () => {
    const mResults = measurementsData?.results || [];
    const items: QuoteFormItem[] = mResults.map((m) => ({
      room_name: m.room_name,
      window_name: m.window_name || "",
      window_width_cm: m.width_cm,
      window_height_cm: m.height_cm,
      fabric_meters: m.curtain_meters ? String(m.curtain_meters) : "",
      fabric_cost: "",
      tulle_meters: m.tulle_meters ? String(m.tulle_meters) : "",
      tulle_cost: "",
      sewing_cost: "",
      installation_price: "",
      accessories_cost: "",
      line_total: "",
    }));
    setFormItems(items);
    setDiscountAmount("");
    setDeliveryCost("");
    setInstallationCost("");
    setPrepaymentPercent("50");
    setValidUntil("");
    setShowForm(true);
  };

  // Пересоздание — предзаполняем форму из существующего КП
  const initFromQuote = (q: QuoteDTO | null) => {
    if (!q) return;
    const ok = window.confirm(
      "Пересоздать КП? Текущее коммерческое предложение будет перезаписано, а PDF — сгенерирован заново."
    );
    if (!ok) return;
    const items: QuoteFormItem[] = q.items.map((it) => ({
      room_name: it.room_name,
      window_name: it.window_name || "",
      window_width_cm: it.window_width_cm,
      window_height_cm: it.window_height_cm,
      fabric_meters: it.fabric_meters || "",
      fabric_cost: it.fabric_cost || "",
      tulle_meters: it.tulle_meters || "",
      tulle_cost: it.tulle_cost || "",
      sewing_cost: it.sewing_cost || "",
      installation_price: it.installation_price || "",
      accessories_cost: it.accessories_cost || "",
      line_total: it.line_total || "",
    }));
    setFormItems(items);
    setDiscountAmount(parseFloat(q.discount_amount) > 0 ? q.discount_amount : "");
    setDeliveryCost(parseFloat(q.delivery_cost) > 0 ? q.delivery_cost : "");
    setInstallationCost(parseFloat(q.installation_cost) > 0 ? q.installation_cost : "");
    setPrepaymentPercent(String(Math.round(parseFloat(q.prepayment_percent) * 100)));
    setValidUntil("");
    setShowForm(true);
  };

  const updateItem = (index: number, field: keyof QuoteFormItem, value: string) => {
    setFormItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      const item = next[index];
      const fabricCost = parseFloat(item.fabric_cost) || 0;
      const tulleCost = parseFloat(item.tulle_cost) || 0;
      const sewingCost = parseFloat(item.sewing_cost) || 0;
      const installPrice = parseFloat(item.installation_price) || 0;
      const accessoriesCost = parseFloat(item.accessories_cost) || 0;
      const total = fabricCost + tulleCost + sewingCost + installPrice + accessoriesCost;
      next[index].line_total = total > 0 ? String(total) : "";
      return next;
    });
  };

  const calculateGrandTotal = (): number => {
    const itemsTotal = formItems.reduce((sum, item) => sum + (parseFloat(item.line_total) || 0), 0);
    const install = parseFloat(installationCost) || 0;
    const delivery = parseFloat(deliveryCost) || 0;
    const discount = parseFloat(discountAmount) || 0;
    return itemsTotal + install + delivery - discount;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const items: QuoteItemPayload[] = formItems.map((item) => ({
      room_name: item.room_name,
      window_name: item.window_name || undefined,
      window_width_cm: item.window_width_cm,
      window_height_cm: item.window_height_cm,
      fabric_meters: item.fabric_meters ? parseFloat(item.fabric_meters) : undefined,
      fabric_cost: item.fabric_cost ? parseFloat(item.fabric_cost) : undefined,
      tulle_meters: item.tulle_meters ? parseFloat(item.tulle_meters) : undefined,
      tulle_cost: item.tulle_cost ? parseFloat(item.tulle_cost) : undefined,
      sewing_cost: item.sewing_cost ? parseFloat(item.sewing_cost) : undefined,
      installation_price: item.installation_price ? parseFloat(item.installation_price) : undefined,
      accessories_cost: item.accessories_cost ? parseFloat(item.accessories_cost) : undefined,
      line_total: parseFloat(item.line_total) || 0,
    }));

    createMutation.mutate({
      order_id: orderId,
      items,
      valid_until: validUntil || undefined,
      discount_amount: discountAmount ? parseFloat(discountAmount) : undefined,
      installation_cost: installationCost ? parseFloat(installationCost) : undefined,
      delivery_cost: deliveryCost ? parseFloat(deliveryCost) : undefined,
      prepayment_percent: prepaymentPercent ? parseFloat(prepaymentPercent) / 100 : undefined,
    });
  };

  const quote = quotesData?.results?.[0] ?? null;

  return (
    <div className="min-h-screen bg-[#F0F4F8] p-3 sm:p-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm mb-4">
        <div className="flex items-center justify-between px-4 sm:px-[52px] py-5 sm:py-[30px]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/orders/${orderId}`)}
              className="text-[#475569] hover:text-[#0EA5E9] transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-[26px] font-semibold text-[#0F172A] leading-tight">
                Коммерческое предложение
              </h1>
              <p className="text-[14px] text-[#94A3B8] mt-0.5">
                {isLoading
                  ? "Загрузка…"
                  : showForm
                  ? "Заполните позиции и стоимость"
                  : quote
                  ? quote.quote_number
                  : "КП ещё не создано"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* States */}
      {isLoading && <LoadingState message="Загрузка КП…" />}

      {isError && !isLoading && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <p className="text-[14px] text-[#DC2626]">{error?.message || "Ошибка загрузки"}</p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && !showForm && !quote && (
        <div className="bg-white rounded-2xl shadow-sm p-10 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-[#EAF8FE] flex items-center justify-center mb-4">
            <FileText size={26} className="text-[#60CCED]" />
          </div>
          <p className="text-[15px] text-[#475569]">КП ещё не создано</p>
          {canEdit && (
            <button
              onClick={initForm}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#60CCED] text-white text-[14px] font-semibold hover:bg-[#4DBCE0] transition-colors"
            >
              <Plus size={18} />
              Создать КП
            </button>
          )}
        </div>
      )}

      {/* Quote (одно на заказ) */}
      {!isLoading && !showForm && quote && (
        <div className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden">
          <div className="px-5 sm:px-7 pt-6">
            <div className="flex items-center justify-between">
              <span className="text-[17px] font-semibold text-[#0F172A]">{quote.quote_number}</span>
              <span className="text-[12px] font-medium text-[#94A3B8] bg-[#F1F5F9] rounded-full px-3 py-1">
                {quote.status_label}
              </span>
            </div>

            <div className="mt-4 space-y-1.5 text-[14px] text-[#475569]">
              <p>Клиент: {quote.customer_name}</p>
              <p>Подытог: {fmtMoney(quote.subtotal)} ₸</p>
              {parseFloat(quote.discount_amount) > 0 && (
                <p>Скидка: −{fmtMoney(quote.discount_amount)} ₸</p>
              )}
              {parseFloat(quote.delivery_cost) > 0 && (
                <p>Доставка: +{fmtMoney(quote.delivery_cost)} ₸</p>
              )}
              {parseFloat(quote.installation_cost) > 0 && (
                <p>Монтаж: +{fmtMoney(quote.installation_cost)} ₸</p>
              )}
            </div>

            <p className="mt-3 text-[20px] font-bold text-[#0F172A]">
              Итого: {fmtMoney(quote.total)} ₸
            </p>
            <p className="mt-1 text-[14px] text-[#475569]">
              Предоплата ({Math.round(parseFloat(quote.prepayment_percent) * 100)}%):{" "}
              {fmtMoney(parseFloat(quote.total) * parseFloat(quote.prepayment_percent))} ₸
            </p>
          </div>

          {quote.items.length > 0 && (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="bg-[#60CCED]">
                    <th className="px-5 sm:px-7 py-3 text-left font-medium text-white whitespace-nowrap">
                      Комната
                    </th>
                    <th className="px-5 py-3 text-left font-medium text-white whitespace-nowrap">
                      Размеры
                    </th>
                    <th className="px-5 sm:px-7 py-3 text-right font-medium text-white whitespace-nowrap">
                      Итого
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items.map((item) => (
                    <tr key={item.id} className="border-b border-[#F1F5F9] last:border-0">
                      <td className="px-5 sm:px-7 py-3 text-[#0F172A]">
                        {item.room_name}
                        {item.window_name ? ` — ${item.window_name}` : ""}
                      </td>
                      <td className="px-5 py-3 text-[#94A3B8]">
                        {item.window_width_cm}×{item.window_height_cm} см
                      </td>
                      <td className="px-5 sm:px-7 py-3 text-right font-semibold text-[#0F172A]">
                        {fmtMoney(item.line_total)} ₸
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canEdit && (
            <div className="px-5 sm:px-7 py-5 flex flex-wrap items-center gap-3">
              <button
                onClick={() => pdfMutation.mutate(quote.id)}
                disabled={pdfMutation.isPending}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#60CCED] text-white text-[14px] font-semibold hover:bg-[#4DBCE0] disabled:opacity-50 transition-colors"
              >
                {pdfMutation.isPending ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Download size={18} />
                )}
                {quote.pdf_generated ? "Перегенерировать PDF" : "Скачать PDF"}
              </button>
              <button
                onClick={() => initFromQuote(quote)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#E2E8F0] text-[#475569] text-[14px] font-medium hover:bg-[#F8FAFC] transition-colors"
              >
                <RefreshCw size={18} />
                Пересоздать КП
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create / Recreate form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-7">
          <h2 className="text-[18px] font-semibold text-[#0F172A] mb-5">
            Новое коммерческое предложение
          </h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            {formItems.map((item, idx) => (
              <div key={idx} className="p-4 bg-[#F8FAFC] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[14px] font-medium text-[#0F172A]">
                    {item.room_name}
                    {item.window_name ? ` — ${item.window_name}` : ""}
                  </h4>
                  <span className="text-[13px] text-[#94A3B8]">
                    {item.window_width_cm}×{item.window_height_cm} см
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Метраж ткани</label>
                    <input
                      type="number"
                      step="0.1"
                      className={inputCls}
                      value={item.fabric_meters}
                      onChange={(e) => updateItem(idx, "fabric_meters", e.target.value)}
                      placeholder="м"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Цена ткани</label>
                    <input
                      type="number"
                      className={inputCls}
                      value={item.fabric_cost}
                      onChange={(e) => updateItem(idx, "fabric_cost", e.target.value)}
                      placeholder="₸"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Метраж тюли</label>
                    <input
                      type="number"
                      step="0.1"
                      className={inputCls}
                      value={item.tulle_meters}
                      onChange={(e) => updateItem(idx, "tulle_meters", e.target.value)}
                      placeholder="м"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Цена тюли</label>
                    <input
                      type="number"
                      className={inputCls}
                      value={item.tulle_cost}
                      onChange={(e) => updateItem(idx, "tulle_cost", e.target.value)}
                      placeholder="₸"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Пошив</label>
                    <input
                      type="number"
                      className={inputCls}
                      value={item.sewing_cost}
                      onChange={(e) => updateItem(idx, "sewing_cost", e.target.value)}
                      placeholder="₸"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Монтаж</label>
                    <input
                      type="number"
                      className={inputCls}
                      value={item.installation_price}
                      onChange={(e) => updateItem(idx, "installation_price", e.target.value)}
                      placeholder="₸"
                    />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Аксессуары</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={item.accessories_cost}
                    onChange={(e) => updateItem(idx, "accessories_cost", e.target.value)}
                    placeholder="₸"
                  />
                </div>

                <p className="text-[13px] font-medium text-[#0F172A]">
                  Итого позиции: {fmtMoney(item.line_total)} ₸
                </p>
              </div>
            ))}

            {formItems.length === 0 && measurementsData && (
              <div className="text-center text-[14px] text-[#94A3B8] py-8">
                Замеры не найдены. Добавьте замеры перед созданием КП.
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Скидка (₸)</label>
                <input
                  type="number"
                  className={inputCls}
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <label className={labelCls}>Предоплата (%)</label>
                <input
                  type="number"
                  className={inputCls}
                  value={prepaymentPercent}
                  onChange={(e) => setPrepaymentPercent(e.target.value)}
                  placeholder="50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Доставка (₸)</label>
                <input
                  type="number"
                  className={inputCls}
                  value={deliveryCost}
                  onChange={(e) => setDeliveryCost(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <label className={labelCls}>Монтаж общий (₸)</label>
                <input
                  type="number"
                  className={inputCls}
                  value={installationCost}
                  onChange={(e) => setInstallationCost(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex items-center justify-between bg-[#F8FAFC] p-4 rounded-xl">
              <span className="text-[15px] font-medium text-[#0F172A]">Итоговая сумма:</span>
              <span className="text-[20px] font-bold text-[#60CCED]">
                {fmtMoney(calculateGrandTotal())} ₸
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#60CCED] text-white text-[14px] font-semibold hover:bg-[#4DBCE0] disabled:opacity-50 transition-colors"
              >
                {createMutation.isPending && <Loader2 size={18} className="animate-spin" />}
                {createMutation.isPending ? "Формирование…" : "Сформировать КП"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2.5 rounded-xl border border-[#E2E8F0] text-[#475569] text-[14px] font-medium hover:bg-[#F8FAFC] transition-colors"
              >
                Отмена
              </button>
            </div>

            {createMutation.isError && (
              <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-[13px] text-[#DC2626]">
                {createMutation.error?.message || "Ошибка сохранения"}
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
}

export default function OrderQuotePage() {
  return (
    <ProtectedRoute>
      <OrderQuoteContent />
    </ProtectedRoute>
  );
}

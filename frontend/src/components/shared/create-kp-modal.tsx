"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModalCloseX } from "./modal-close";
import { useCreateQuote, type CreateQuoteInput } from "@/hooks/useQuotes";
import { useOrder } from "@/hooks/useOrders";
import { generateQuotePdf } from "@/services/http/orders";
import type { OrderDetailDTO, OrderItemDTO } from "@/types";

function fmtNum(v: number): string {
  if (!v || isNaN(v)) return "0";
  return Math.round(v).toLocaleString("ru-RU");
}
function lineTotalOf(item: OrderItemDTO): number {
  return parseFloat(item.total_price || "0");
}

interface CreateKPModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  order?: OrderDetailDTO;
  onSuccess?: (quoteId: string) => void;
}

export function CreateKPModal({ isOpen, onClose, orderId, order: orderProp, onSuccess }: CreateKPModalProps) {
  const { data: fetchedOrder } = useOrder(orderProp ? null : orderId);
  const order = orderProp ?? fetchedOrder;

  const [discountPercent, setDiscountPercent] = useState("");
  const [installPrice, setInstallPrice] = useState("");
  const [prepayPct, setPrepayPct] = useState("50");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const createQuoteMutation = useCreateQuote();
  const items: OrderItemDTO[] = order?.items ?? [];

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, it) => s + lineTotalOf(it), 0);
    const discountAmt = discountPercent ? Math.round((subtotal * parseFloat(discountPercent)) / 100) : 0;
    const installAmt = installPrice ? parseInt(installPrice) || 0 : 0;
    const total = subtotal - discountAmt + installAmt;
    return { subtotal, discountAmt, installAmt, total };
  }, [items, discountPercent, installPrice]);

  const customerId = typeof order?.customer === "object" ? order.customer.id : order?.customer ?? "";

  const reset = () => { setDiscountPercent(""); setInstallPrice(""); setPrepayPct("50"); setErr(null); };
  const close = () => { reset(); onClose(); };

  async function handleDownload() {
    if (!customerId || items.length === 0 || busy) return;
    setBusy(true); setErr(null);
    try {
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 7);
      const payload: CreateQuoteInput = {
        customer: customerId,
        order: orderId,
        order_id: orderId,
        status: "draft",
        valid_until: validUntil.toISOString().split("T")[0],
        subtotal: totals.subtotal,
        discount_amount: totals.discountAmt,
        installation_cost: totals.installAmt,
        delivery_cost: 0,
        prepayment_percent: (parseInt(prepayPct) || 50) / 100,
        items: items.map((item) => ({
          room_name: item.room_name || "Комната",
          window_name: item.window_name || "Окно",
          window_width_cm: item.window_width_cm ?? 0,
          window_height_cm: item.window_height_cm ?? 0,
          folds_count: item.folds_count ?? 0,
          line_total: lineTotalOf(item),
          fabric: item.fabric || null,
          fabric_meters: 0,
          fabric_cost: 0,
          tulle_fabric: null,
          tulle_meters: 0,
          tulle_cost: 0,
          sewing_type: item.sewing_type || "standard",
          complexity: "simple",
          sewing_cost: 0,
          cornice: null,
          cornice_length_m: 0,
          cornice_cost: 0,
          installation_price: 0,
          accessories_cost: 0,
          additional_services_total: 0,
        })),
      };
      const quote = await createQuoteMutation.mutateAsync(payload);
      try {
        const res = await generateQuotePdf(quote.id);
        if (res?.pdf_url) {
          const base = process.env.NEXT_PUBLIC_API_BASE_URL || "";
          const url = res.pdf_url.startsWith("http") ? res.pdf_url : `${base}${res.pdf_url}`;
          window.open(url, "_blank");
        }
      } catch {
        /* PDF не критично — КП уже создано */
      }
      onSuccess?.(quote.id);
      close();
    } catch (e) {
      setErr((e as Error)?.message || "Не удалось создать КП");
    } finally {
      setBusy(false);
    }
  }

  const fieldCls =
    "rounded-[10px] bg-[#E9E9E9] border-none px-3 py-2.5 text-[15px] text-[#0F172A] outline-none text-left";

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="sm:max-w-[560px] p-0 gap-0 overflow-auto max-h-[90vh] [&>button]:hidden">
        <div><ModalCloseX onClose={close} /></div>
        <DialogHeader className="sr-only">
          <DialogTitle>Коммерческое предложение</DialogTitle>
        </DialogHeader>

        <div className="px-8 pt-[72px] pb-8">
          {items.length === 0 ? (
            <div className="rounded-[10px] bg-[#F1F5F9] px-4 py-6 text-center text-[14px] text-[#94A3B8]">
              Нет позиций — сначала добавьте замер
            </div>
          ) : (
            <>
              {items.map((item) => {
                const qty = Math.round(Number(item.quantity ?? 1));
                const dims =
                  item.window_width_cm && item.window_height_cm
                    ? ` (${item.window_width_cm}x${item.window_height_cm})`
                    : "";
                return (
                  <div key={item.id} className="flex items-start justify-between border-b border-[#E2E8F0] py-4">
                    <div className="text-[15px] text-[#0F172A]">
                      <div>{item.room_name || "Комната"}</div>
                      <div>{(item.window_name || "Окно") + dims}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[16px] font-medium text-[#0F172A] whitespace-nowrap">{fmtNum(lineTotalOf(item))} ₸</div>
                      {qty > 1 && <div className="text-[13px] text-[#94A3B8]">({qty} шт.)</div>}
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center justify-between py-5 text-[16px] text-[#0F172A]">
                <span>Предытог</span>
                <span className="font-medium whitespace-nowrap">{fmtNum(totals.subtotal)} ₸</span>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-[16px] text-[#0F172A]">Установка:</span>
                <div className="flex items-center gap-2">
                  <input inputMode="numeric" value={installPrice} onChange={(e) => setInstallPrice(e.target.value.replace(/\D/g, ""))} placeholder="0" className={`${fieldCls} w-28`} />
                  <span className="text-[15px] text-[#475569]">₸</span>
                </div>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-[16px] text-[#0F172A]">Скидка:</span>
                <div className="flex items-center gap-2">
                  <input inputMode="numeric" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value.replace(/\D/g, ""))} placeholder="0" className={`${fieldCls} w-16`} />
                  <span className="text-[15px] text-[#475569]">%</span>
                </div>
              </div>

              <div className="flex items-center justify-between py-5 text-[20px] font-bold text-[#0F172A]">
                <span>ИТОГО</span>
                <span className="whitespace-nowrap">{fmtNum(totals.total)} ₸</span>
              </div>

              <div className="mb-6 flex items-center justify-between py-2">
                <span className="text-[16px] text-[#0F172A]">Предоплата:</span>
                <div className="flex items-center gap-2">
                  <input inputMode="numeric" value={prepayPct} onChange={(e) => setPrepayPct(e.target.value.replace(/\D/g, ""))} placeholder="50" className={`${fieldCls} w-16`} />
                  <span className="text-[15px] text-[#475569]">%</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownload}
                disabled={items.length === 0 || busy}
                className="w-full rounded-[10px] bg-[#60CCED] py-[14px] text-[15px] font-semibold text-white transition-colors hover:bg-[#4DBCE0] disabled:opacity-50"
              >
                {busy ? "Формирование..." : "Скачать КП"}
              </button>
              {err && <p className="mt-2 text-center text-[13px] text-[#DC2626]">{err}</p>}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

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

  /**
   * Строки КП: позиции заказа, а если их ещё нет — замеры.
   *
   * OrderItem'ы генерируются ИЗ утверждённого КП, поэтому у нового заказа их
   * не бывает: модалка показывала «Нет позиций — сначала добавьте замер» даже
   * когда замеры были, и создать КП с веба было невозможно. Цена по окну
   * вводится вручную (авторасчёт цены запаркован), как и в мобилке.
   */
  const [prices, setPrices] = useState<Record<string, string>>({});

  const lines = useMemo(() => {
    if (items.length > 0) {
      return items.map((it) => ({
        key: it.id,
        room: it.room_name || "Комната",
        window: it.window_name || "Окно",
        width: it.window_width_cm ?? 0,
        height: it.window_height_cm ?? 0,
        qty: Math.round(Number(it.quantity ?? 1)),
        price: lineTotalOf(it),
        editable: false,
        fabric: it.fabric || null,
        sewingType: it.sewing_type || "standard",
        folds: it.folds_count ?? 0,
      }));
    }
    return (order?.measurements ?? []).map((m) => ({
      key: m.id,
      room: m.room_name || "Комната",
      window: m.window_name || "Окно",
      width: m.width_cm ?? 0,
      height: m.height_cm ?? 0,
      qty: 1,
      price: parseFloat(prices[m.id] || "0") || 0,
      editable: true,
      fabric: null as string | null,
      sewingType: "standard",
      folds: 0,
    }));
  }, [items, order?.measurements, prices]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + l.price, 0);
    const installAmt = installPrice ? parseInt(installPrice) || 0 : 0;
    // Скидка считается от предытога вместе с установкой — так же, как в
    // мобильном экране КП, иначе веб и телефон дадут разное ИТОГО.
    const discountAmt = discountPercent
      ? Math.round(((subtotal + installAmt) * parseFloat(discountPercent)) / 100)
      : 0;
    const total = subtotal + installAmt - discountAmt;
    return { subtotal, discountAmt, installAmt, total };
  }, [lines, discountPercent, installPrice]);

  const customerId = typeof order?.customer === "object" ? order.customer.id : order?.customer ?? "";

  const reset = () => {
    setDiscountPercent(""); setInstallPrice(""); setPrepayPct("50"); setErr(null); setPrices({});
  };
  const close = () => { reset(); onClose(); };

  async function handleDownload() {
    if (!customerId || lines.length === 0 || busy) return;
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
        items: lines.map((line) => ({
          room_name: line.room,
          window_name: line.window,
          window_width_cm: line.width,
          window_height_cm: line.height,
          folds_count: line.folds,
          line_total: line.price,
          fabric: line.fabric,
          fabric_meters: 0,
          fabric_cost: 0,
          tulle_fabric: null,
          tulle_meters: 0,
          tulle_cost: 0,
          sewing_type: line.sewingType,
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
          {lines.length === 0 ? (
            <div className="rounded-[10px] bg-[#F1F5F9] px-4 py-6 text-center text-[14px] text-[#94A3B8]">
              Нет позиций — сначала добавьте замер
            </div>
          ) : (
            <>
              {lines.map((line) => {
                const dims = line.width && line.height ? ` (${line.width}x${line.height})` : "";
                return (
                  <div key={line.key} className="flex items-start justify-between border-b border-[#E2E8F0] py-4">
                    <div className="text-[15px] text-[#0F172A]">
                      <div>{line.room}</div>
                      <div>{line.window + dims}</div>
                    </div>
                    <div className="text-right">
                      {line.editable ? (
                        <div className="flex items-center gap-2">
                          <input
                            inputMode="numeric"
                            value={prices[line.key] ?? ""}
                            onChange={(e) =>
                              setPrices((p) => ({ ...p, [line.key]: e.target.value.replace(/\D/g, "") }))
                            }
                            placeholder="0"
                            className={`${fieldCls} w-32 text-right`}
                          />
                          <span className="text-[15px] text-[#475569]">₸</span>
                        </div>
                      ) : (
                        <div className="text-[16px] font-medium text-[#0F172A] whitespace-nowrap">
                          {fmtNum(line.price)} ₸
                        </div>
                      )}
                      {line.qty > 1 && <div className="text-[13px] text-[#94A3B8]">({line.qty} шт.)</div>}
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
                disabled={lines.length === 0 || totals.subtotal <= 0 || busy}
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

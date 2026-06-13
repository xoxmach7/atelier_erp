"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useCreateQuote, type CreateQuoteInput } from "@/hooks/useQuotes";
import { useOrder } from "@/hooks/useOrders";
import type { OrderDetailDTO, OrderItemDTO } from "@/types";

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function fmtCurrency(v: number): string {
  if (!v || isNaN(v)) return "—";
  return v.toLocaleString("ru-RU") + " ₸";
}

/* ------------------------------------------------------------------ */
/*  Props                                                               */
/* ------------------------------------------------------------------ */

interface CreateKPModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  /** Pre-loaded order — if not provided, fetched internally */
  order?: OrderDetailDTO;
  onSuccess?: (quoteId: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export function CreateKPModal({
  isOpen,
  onClose,
  orderId,
  order: orderProp,
  onSuccess,
}: CreateKPModalProps) {
  const router = useRouter();
  // Fetch order if not provided as prop
  const { data: fetchedOrder } = useOrder(orderProp ? null : orderId);
  const order = orderProp ?? fetchedOrder;

  // Form state
  const [discountPercent, setDiscountPercent] = useState("");
  const [validDays, setValidDays] = useState("7");
  const [includeInstall, setIncludeInstall] = useState(true);
  const [installPrice, setInstallPrice] = useState("");
  const [notes, setNotes] = useState("");

  const createQuoteMutation = useCreateQuote();

  // Items from order
  const items: OrderItemDTO[] = order?.items ?? [];

  // Calculate totals
  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + parseFloat(item.total_price || "0"),
      0
    );
    const discountAmt = discountPercent
      ? Math.round(subtotal * parseFloat(discountPercent) / 100)
      : 0;
    const installAmt =
      includeInstall && installPrice ? parseInt(installPrice) : 0;
    const total = subtotal - discountAmt + installAmt;
    return { subtotal, discountAmt, installAmt, total };
  }, [items, discountPercent, includeInstall, installPrice]);

  // Get customer ID from order
  const customerId =
    typeof order?.customer === "object"
      ? order.customer.id
      : order?.customer ?? "";
  const customerName =
    typeof order?.customer === "object"
      ? order.customer.full_name
      : "—";

  // Reset
  const resetForm = () => {
    setDiscountPercent("");
    setValidDays("7");
    setIncludeInstall(true);
    setInstallPrice("");
    setNotes("");
  };

  // Submit — creates a Quote via API
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || items.length === 0) return;

    // Build valid_until date
    const days = parseInt(validDays) || 7;
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + days);

    const payload: CreateQuoteInput = {
      customer: customerId,
      order: orderId,
      status: "draft",
      valid_until: validUntil.toISOString().split("T")[0],
      subtotal: totals.subtotal,
      discount_amount: totals.discountAmt,
      installation_cost: totals.installAmt,
      delivery_cost: 0,
      prepayment_percent: 50,
      items: items.map((item) => ({
        room_name: item.room_name || "Комната",
        window_name: item.window_name || "Окно",
        window_width_cm: item.window_width_cm ?? 0,
        window_height_cm: item.window_height_cm ?? 0,
        folds_count: item.folds_count ?? 0,
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

    try {
      const result = await createQuoteMutation.mutateAsync(payload);
      onSuccess?.(result.id);
      resetForm();
      onClose();
      router.push(`/orders/${orderId}/quote`);
    } catch {
      // Error handled by mutation state
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
      onClose();
    }
  };

  const inputCls =
    "h-11 border-none bg-[#E9E9E9] rounded-[var(--r)] text-[14px] text-[var(--t1)] placeholder:text-[var(--t3)] focus-visible:ring-[var(--a)]/30";

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-0 gap-0 overflow-auto max-h-[90vh]">
        <div className="px-8 pt-7 pb-8">
          {/* Header */}
          <DialogHeader className="mb-7">
            <DialogTitle className="text-[24px] font-bold text-[var(--t1)]">
              Создание КП
            </DialogTitle>
            {order && (
              <DialogDescription className="text-[13px] text-[var(--t3)]">
                Заказ №{order.order_number} · {customerName}
              </DialogDescription>
            )}
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-[18px]">
            {/* Positions list */}
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[var(--t1)]">
                Позиции в заказе
              </Label>
              {items.length === 0 ? (
                <div className="rounded-[var(--r)] bg-[#F1F5F9] px-4 py-4 text-[13px] text-[var(--t3)] text-center">
                  Нет позиций — сначала добавьте замер
                </div>
              ) : (
                <div className="space-y-1.5">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-[var(--r)] bg-[#F1F5F9] px-3.5 py-2.5"
                    >
                      <div>
                        <div className="text-[13px] font-medium text-[var(--t1)]">
                          {[item.room_name, item.window_name]
                            .filter(Boolean)
                            .join(" / ") || "Позиция"}
                        </div>
                        {item.window_width_cm && item.window_height_cm && (
                          <div className="text-[11px] text-[var(--t3)]">
                            {item.window_width_cm}×{item.window_height_cm}
                          </div>
                        )}
                      </div>
                      <span className="text-[13px] font-semibold text-[var(--t1)]">
                        {fmtCurrency(parseFloat(item.total_price || "0"))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Discount + Valid days */}
            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label className="text-[13px] font-medium text-[var(--t1)]">
                  Скидка (%)
                </Label>
                <Input
                  className={inputCls}
                  type="number"
                  min={0}
                  max={100}
                  placeholder="0"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] font-medium text-[var(--t1)]">
                  Действует (дней)
                </Label>
                <Input
                  className={inputCls}
                  type="number"
                  min={1}
                  placeholder="7"
                  value={validDays}
                  onChange={(e) => setValidDays(e.target.value)}
                />
              </div>
            </div>

            {/* Installation */}
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <Checkbox
                  id="include-install"
                  checked={includeInstall}
                  onCheckedChange={(v) =>
                    setIncludeInstall(v === true)
                  }
                  className="data-[state=checked]:bg-[var(--a)] data-[state=checked]:border-[var(--a)]"
                />
                <Label
                  htmlFor="include-install"
                  className="text-[13px] font-medium text-[var(--t1)] cursor-pointer"
                >
                  Включить установку
                </Label>
              </div>
              {includeInstall && (
                <Input
                  className={inputCls}
                  type="number"
                  min={0}
                  placeholder="Стоимость установки (₸)"
                  value={installPrice}
                  onChange={(e) => setInstallPrice(e.target.value)}
                />
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium text-[var(--t1)]">
                Примечания к КП
              </Label>
              <Textarea
                className="border-none bg-[#E9E9E9] rounded-[var(--r)] text-[14px] text-[var(--t1)] placeholder:text-[var(--t3)] min-h-[72px] resize-y focus-visible:ring-[var(--a)]/30"
                placeholder="Дополнительные условия, примечания для клиента"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Total summary */}
            <div className="rounded-[var(--r)] bg-[#F1F5F9] p-4 space-y-1.5">
              <div className="flex justify-between text-[13px] text-[var(--t2)]">
                <span>Подитог</span>
                <span>{fmtCurrency(totals.subtotal)}</span>
              </div>
              {totals.discountAmt > 0 && (
                <div className="flex justify-between text-[13px] text-[#16A34A]">
                  <span>Скидка {discountPercent}%</span>
                  <span>−{fmtCurrency(totals.discountAmt)}</span>
                </div>
              )}
              {totals.installAmt > 0 && (
                <div className="flex justify-between text-[13px] text-[var(--t2)]">
                  <span>Установка</span>
                  <span>+{fmtCurrency(totals.installAmt)}</span>
                </div>
              )}
              <div className="flex justify-between text-[15px] font-bold text-[var(--t1)] border-t border-[#E2E8F0] pt-2 mt-1">
                <span>Итого</span>
                <span>{fmtCurrency(totals.total)}</span>
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={items.length === 0 || createQuoteMutation.isPending}
              className="w-full h-12 bg-[var(--a)] hover:bg-[var(--ad)] text-white text-[15px] font-semibold rounded-[var(--r)] mt-1 disabled:opacity-50"
            >
              {createQuoteMutation.isPending
                ? "Формирование..."
                : "Сформировать КП"}
            </Button>

            {/* Error */}
            {createQuoteMutation.isError && (
              <p className="text-[13px] text-[#DC2626] text-center">
                {createQuoteMutation.error?.message ||
                  "Не удалось создать КП"}
              </p>
            )}
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

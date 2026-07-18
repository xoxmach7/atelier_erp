"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { ModalCloseX } from "./modal-close";
import type { PaymentDTO } from "@/types";
import { fmtMoney, fmtDigits } from "@/lib/money";

interface CreatePrepaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { amount: number; pct: number; method: string }) => void;
  orderTotal?: number;
  payments?: PaymentDTO[];
  requiredPct?: number;
  isLoading?: boolean;
  onDelete?: (paymentId: string) => void;
  deletingId?: string | null;
}

function fmtDate(v: string): string {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function CreatePrepaymentModal({
  isOpen,
  onClose,
  onSave,
  orderTotal = 0,
  payments = [],
  requiredPct = 50,
  isLoading = false,
  onDelete,
  deletingId = null,
}: CreatePrepaymentModalProps) {
  const [amount, setAmount] = useState("");

  if (!isOpen) return null;

  function handleClose() {
    setAmount("");
    onClose();
  }

  const prepay = payments.filter((p) => p.payment_type === "prepayment");
  const required = Math.round((orderTotal * requiredPct) / 100);
  const paid = prepay.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const remaining = Math.max(0, required - paid);

  const amountNum = parseInt(amount.replace(/\s/g, ""), 10) || 0;
  const canSubmit = amountNum > 0 && !isLoading;

  function submit() {
    if (amountNum <= 0) return;
    const pct = orderTotal > 0 ? Math.round((amountNum / orderTotal) * 100) : 0;
    onSave({ amount: amountNum, pct, method: "cash" });
    setAmount("");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(15,23,42,.35)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="relative w-full max-w-[480px] rounded-[14px] bg-white shadow-2xl">
        <ModalCloseX onClose={handleClose} />

        <div className="px-7 pb-8 pt-[72px]">
          <h2 className="mb-7 text-[24px] font-medium text-[#0F172A]">Предоплата</h2>

          {/* Размер */}
          <div className="mb-5 flex items-center gap-4">
            <span className="w-32 shrink-0 text-[16px] text-[#475569]">Размер:</span>
            <span className="text-[18px] font-medium text-[#0F172A]">{fmtMoney(required)} ₸</span>
          </div>

          {/* Внесено + добавить */}
          <div className="mb-5 flex items-center gap-3">
            <span className="w-32 shrink-0 text-[16px] text-[#475569]">Внесено:</span>
            <div className="flex items-center gap-2 rounded-[10px] bg-[#E9E9E9] px-3 py-[11px]">
              <input
                inputMode="numeric"
                value={amount ? fmtDigits(amount) : ""}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                placeholder="0"
                className="w-32 border-none bg-transparent text-[15px] text-[#0F172A] outline-none"
              />
              <span className="text-[15px] text-[#475569]">₸</span>
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[#60CCED] text-[22px] leading-none text-white transition-colors hover:bg-[#4DBCE0] disabled:opacity-50"
              aria-label="Добавить платёж"
            >
              +
            </button>
          </div>

          {/* История */}
          {prepay.length > 0 && (
            <div className="mb-6 rounded-[10px] bg-[#F8FAFC] px-5 py-4">
              {prepay.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-1.5 text-[15px] text-[#0F172A]">
                  <span className="flex-1">{fmtDate(p.received_at)}</span>
                  <span className="flex-1 text-right">{fmtMoney(p.amount)} ₸</span>
                  {onDelete ? (
                    <button
                      type="button"
                      onClick={() => onDelete(p.id)}
                      disabled={deletingId === p.id}
                      className="ml-4 grid h-7 w-7 shrink-0 place-items-center rounded-[8px] text-[#94A3B8] transition-colors hover:bg-[#FEE2E2] hover:text-[#DC2626] disabled:opacity-40"
                      aria-label="Удалить платёж"
                      title="Удалить платёж"
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : (
                    <span className="ml-4 text-[#94A3B8]">—</span>
                  )}
                </div>
              ))}
              <div className="mt-1.5 flex items-center justify-between border-t border-[#E2E8F0] pt-2.5 text-[15px] font-medium text-[#0F172A]">
                <span>Осталось</span>
                <span>{fmtMoney(remaining)} ₸</span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="w-full rounded-[10px] bg-[#60CCED] py-[14px] text-[15px] font-semibold text-white transition-colors hover:bg-[#4DBCE0] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

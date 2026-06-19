"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface CreatePrepaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { amount: number; pct: number; method: string }) => void;
  orderTotal?: number;
  isLoading?: boolean;
}

function fmtNum(v: string | number): string {
  return String(v).replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function CreatePrepaymentModal({
  isOpen,
  onClose,
  onSave,
  orderTotal = 0,
  isLoading = false,
}: CreatePrepaymentModalProps) {
  const initialPct = orderTotal > 0 ? 50 : 0;
  const initialAmount = orderTotal > 0 ? Math.round(orderTotal * 0.5) : 0;

  const [pct, setPct] = useState(String(initialPct));
  const [amount, setAmount] = useState(initialAmount > 0 ? String(initialAmount) : "");

  useEffect(() => {
    if (isOpen) {
      const p = orderTotal > 0 ? 50 : 0;
      const a = orderTotal > 0 ? Math.round(orderTotal * 0.5) : 0;
      setPct(String(p));
      setAmount(a > 0 ? String(a) : "");
    }
  }, [isOpen, orderTotal]);

  function handlePct(raw: string) {
    const v = raw.replace(/\D/g, "");
    setPct(v);
    if (orderTotal > 0 && v !== "") {
      const computed = Math.round(orderTotal * parseInt(v, 10) / 100);
      setAmount(String(computed));
    }
  }

  function handleAmount(raw: string) {
    const v = raw.replace(/\s/g, "").replace(/\D/g, "");
    setAmount(v);
    if (orderTotal > 0 && v !== "") {
      const computed = Math.min(100, Math.round(parseInt(v, 10) / orderTotal * 100));
      setPct(String(computed));
    }
  }

  function handleSubmit() {
    const amountNum = parseInt(amount.replace(/\s/g, ""), 10) || 0;
    const pctNum = parseInt(pct, 10) || 0;
    if (amountNum <= 0) return;
    onSave({ amount: amountNum, pct: pctNum, method: "cash" });
  }

  if (!isOpen) return null;

  const amountNum = parseInt(amount.replace(/\s/g, ""), 10) || 0;
  const canSubmit = amountNum > 0 && !isLoading;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(15,23,42,.35)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full bg-white rounded-[14px] shadow-2xl overflow-hidden"
        style={{ maxWidth: 480, animation: "modalIn .2s ease-out" }}
      >
        <style>{`
          @keyframes modalIn {
            from { opacity: 0; transform: translateY(12px) scale(.97); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>

        <div className="p-7 pb-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-7">
            <h2 className="text-[24px] font-bold text-[#0F172A]">Предоплата</h2>
            <button
              onClick={onClose}
              className="text-[#475569] hover:text-[#0F172A] transition-colors p-0.5"
            >
              <X size={22} />
            </button>
          </div>

          <div className="flex flex-col gap-5">
            {/* % field */}
            <div className="flex items-center gap-4">
              <label className="text-[15px] font-medium text-[#0F172A] w-44 shrink-0">
                Размер предоплаты:
              </label>
              <input
                inputMode="numeric"
                value={pct}
                onChange={(e) => handlePct(e.target.value)}
                className="w-20 text-left rounded-[10px] bg-[#E9E9E9] border-none px-3 py-[11px] text-[15px] text-[#0F172A] outline-none focus:ring-2 focus:ring-[#0EA5E9]"
              />
              <span className="text-[16px] text-[#475569]">%</span>
            </div>

            {/* Amount field */}
            <div className="flex items-center gap-4">
              <label className="text-[15px] font-medium text-[#0F172A] w-44 shrink-0">
                Внесено:
              </label>
              <input
                inputMode="numeric"
                value={amount ? fmtNum(amount) : ""}
                onChange={(e) => handleAmount(e.target.value)}
                placeholder="0"
                className="w-44 text-left rounded-[10px] bg-[#E9E9E9] border-none px-3 py-[11px] text-[15px] text-[#0F172A] outline-none focus:ring-2 focus:ring-[#0EA5E9]"
              />
              <span className="text-[16px] text-[#475569]">₸</span>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full py-[14px] rounded-[10px] bg-[#60CCED] text-white text-[15px] font-semibold mt-2 transition-opacity hover:bg-[#4DBCE0] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

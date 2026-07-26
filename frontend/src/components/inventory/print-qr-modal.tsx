"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ModalCloseX } from "@/components/shared/modal-close";
import { buildInventoryQrValue } from "@/lib/inventory-qr";
import type { InventoryItemDTO } from "@/types";

export function PrintQrModal({
  item,
  onClose,
}: {
  item: InventoryItemDTO;
  onClose: () => void;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    setError(false);
    QRCode.toDataURL(buildInventoryQrValue(item.id), { width: 240, margin: 1 })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [item.id, retryCount]);

  useEffect(() => {
    // Бэкстоп: если модалка закрылась/размонтировалась раньше, чем сработал
    // "afterprint" (например, пользователь закрыл её сразу после клика
    // "Печать"), класс печати не должен остаться навсегда — иначе следующая
    // печать где угодно в приложении покажет пустую страницу (см. CSS-правило
    // в globals.css, оно завязано только на body.printing-qr-label).
    return () => {
      document.body.classList.remove("printing-qr-label");
    };
  }, []);

  const handleRetry = () => setRetryCount((c) => c + 1);

  const handlePrint = () => {
    document.body.classList.add("printing-qr-label");
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      document.body.classList.remove("printing-qr-label");
      window.removeEventListener("afterprint", finish);
      clearTimeout(fallbackTimer);
    };
    // Бэкстоп: некоторые мобильные браузеры (например iOS Safari, когда
    // window.print() открывает share sheet вместо системного диалога печати)
    // не всегда диспатчат "afterprint" — без таймера класс мог бы остаться
    // навсегда, пока модалка ещё открыта (unmount-бэкстоп выше тут не сработает).
    const fallbackTimer = setTimeout(finish, 5000);
    window.addEventListener("afterprint", finish);
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(15,23,42,.35)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-[380px] rounded-[14px] bg-white p-6 shadow-2xl">
        <ModalCloseX onClose={onClose} />
        <div className="pt-10 text-center">
          <h2 className="mb-4 text-[18px] font-semibold text-[#0F172A]">Печать QR-этикетки</h2>

          <div
            id="qr-print-area"
            className="mx-auto flex flex-col items-center gap-2 rounded-[10px] border border-[#E2E8F0] p-4"
          >
            {error ? (
              <div className="flex h-[160px] w-[160px] flex-col items-center justify-center gap-2 text-center">
                <p className="text-[13px] text-[#DC2626]">Не удалось сгенерировать QR-код</p>
                <button
                  onClick={handleRetry}
                  className="rounded-[8px] border border-[#E2E8F0] px-3 py-1 text-[13px] font-medium text-[#0F172A] transition-colors hover:bg-[#F1F5F9]"
                >
                  Повторить
                </button>
              </div>
            ) : dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={dataUrl} alt="QR-код материала" width={160} height={160} />
            ) : (
              <div className="flex h-[160px] w-[160px] items-center justify-center text-[13px] text-[#94A3B8]">
                Генерация...
              </div>
            )}
            <p className="text-[14px] font-medium text-[#0F172A]">{item.name}</p>
            <p className="text-[12px] text-[#94A3B8]">
              {item.category_display}
              {item.sku ? ` · ${item.sku}` : ""}
            </p>
          </div>

          <button
            onClick={handlePrint}
            disabled={!dataUrl}
            className="mt-6 w-full rounded-[10px] bg-[#60CCED] py-[12px] text-[15px] font-semibold text-white transition-colors hover:bg-[#4DBCE0] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Печать
          </button>
        </div>
      </div>
    </div>
  );
}

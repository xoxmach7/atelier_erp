"use client";

import { X } from "lucide-react";

/** Единый close-крестик модалок: cyan-квадрат, белый X, верхний-левый угол. */
export function ModalCloseX({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Закрыть"
      className="absolute left-5 top-5 z-10 grid h-10 w-10 place-items-center rounded-[10px] bg-[#60CCED] text-white transition-colors hover:bg-[#4DBCE0]"
    >
      <X size={22} />
    </button>
  );
}

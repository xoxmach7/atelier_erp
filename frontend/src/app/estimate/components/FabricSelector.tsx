"use client";

import { Label } from "@/components/ui/label";
import type { FabricDTO } from "@/types";
import {
  formatCurrency,
  formatMeters,
  hasEnoughStock,
} from "../utils/estimateHelpers";
import { CheckCircle2, AlertTriangle } from "lucide-react";

interface FabricSelectorProps {
  label: string;
  fabrics: FabricDTO[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  requiredMeters: number;
}

export function FabricSelector({
  label,
  fabrics,
  selectedId,
  onSelect,
  requiredMeters,
}: FabricSelectorProps) {
  const selectedFabric = fabrics.find((f) => f.id === selectedId);
  const enoughStock = hasEnoughStock(selectedFabric, requiredMeters);

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <select
        value={selectedId || ""}
        onChange={(e) => onSelect(e.target.value || null)}
        className="h-8 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
      >
        <option value="">— Без ткани —</option>
        {fabrics.map((fabric) => (
          <option key={fabric.id} value={fabric.id}>
            {fabric.hanger_number} • {fabric.name} ({formatMeters(parseFloat(fabric.available_meters))})
          </option>
        ))}
      </select>

      {selectedFabric && (
        <div className="text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">Цена:</span>
            <span>{formatCurrency(parseFloat(selectedFabric.price_per_meter))}/м</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Доступно:</span>
            <span className={enoughStock ? "text-green-600" : "text-red-600"}>
              {enoughStock ? (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {formatMeters(parseFloat(selectedFabric.available_meters))}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Только {formatMeters(parseFloat(selectedFabric.available_meters))}
                </span>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

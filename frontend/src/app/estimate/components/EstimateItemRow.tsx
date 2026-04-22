"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FabricDTO, EstimateItem } from "@/types";
import { FabricSelector } from "./FabricSelector";
import { formatCurrency, calculateLineTotal } from "../utils/estimateHelpers";
import { Trash2 } from "lucide-react";

interface EstimateItemRowProps {
  item: EstimateItem;
  fabrics: FabricDTO[];
  onUpdate: (updates: Partial<EstimateItem>) => void;
  onDelete: () => void;
}

export function EstimateItemRow({ item, fabrics, onUpdate, onDelete }: EstimateItemRowProps) {
  const { curtainCost, tulleCost, total } = calculateLineTotal(item, fabrics);

  const curtainFabric = fabrics.find((f) => f.id === item.curtain_fabric_id);
  const tulleFabric = fabrics.find((f) => f.id === item.tulle_fabric_id);

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-white">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 grid grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Item name</Label>
            <Input
              value={item.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder="e.g., Window 1"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Width (cm)</Label>
            <Input
              type="number"
              value={item.width_cm || ""}
              onChange={(e) => onUpdate({ width_cm: parseInt(e.target.value) || 0 })}
              placeholder="cm"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Height (cm)</Label>
            <Input
              type="number"
              value={item.height_cm || ""}
              onChange={(e) => onUpdate({ height_cm: parseInt(e.target.value) || 0 })}
              placeholder="cm"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Line Total</Label>
            <div className="h-8 flex items-center font-semibold text-slate-900">
              {formatCurrency(total)}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-600">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-3">
          <FabricSelector
            label="Curtain Fabric"
            fabrics={fabrics}
            selectedId={item.curtain_fabric_id}
            onSelect={(id) => onUpdate({ curtain_fabric_id: id })}
            requiredMeters={item.curtain_fabric_meters}
          />
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Meters:</Label>
            <Input
              type="number"
              step="0.1"
              value={item.curtain_fabric_meters || ""}
              onChange={(e) =>
                onUpdate({ curtain_fabric_meters: parseFloat(e.target.value) || 0 })
              }
              className="h-7 text-sm w-24"
            />
            {curtainFabric && (
              <span className="text-xs text-slate-500">= {formatCurrency(curtainCost)}</span>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <FabricSelector
            label="Tulle Fabric"
            fabrics={fabrics}
            selectedId={item.tulle_fabric_id}
            onSelect={(id) => onUpdate({ tulle_fabric_id: id })}
            requiredMeters={item.tulle_fabric_meters}
          />
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Meters:</Label>
            <Input
              type="number"
              step="0.1"
              value={item.tulle_fabric_meters || ""}
              onChange={(e) =>
                onUpdate({ tulle_fabric_meters: parseFloat(e.target.value) || 0 })
              }
              className="h-7 text-sm w-24"
            />
            {tulleFabric && (
              <span className="text-xs text-slate-500">= {formatCurrency(tulleCost)}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

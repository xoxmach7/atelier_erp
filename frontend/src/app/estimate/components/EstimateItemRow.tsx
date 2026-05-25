"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FabricDTO, EstimateItem, EstimateSupplyMode } from "@/types";
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
  const { lineTotal } = calculateLineTotal(item, fabrics);

  return (
    <div className="bg-[var(--card-sheber)] border border-[var(--border-sheber)] rounded-[var(--r)] p-4 space-y-4 shadow-[var(--sh)]">
      {/* Header: Window name, dimensions, total */}
      <div className="flex items-start justify-between gap-4 pb-3 border-b border-[var(--borderl)]">
        <div className="flex-1 grid grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-[var(--t2)] uppercase tracking-wide">Окно / изделие</Label>
            <Input
              value={item.window_name}
              onChange={(e) => onUpdate({ window_name: e.target.value })}
              placeholder="Окно 1"
              className="h-8 text-sm bg-[var(--input-bg)] border-[var(--border-sheber)] text-[var(--t1)] focus:ring-[var(--a)]/20 focus:border-[var(--a)]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-[var(--t2)] uppercase tracking-wide">Ширина (см)</Label>
            <Input
              type="number"
              value={item.width_cm ?? ""}
              onChange={(e) => onUpdate({ width_cm: parseInt(e.target.value) || 0 })}
              placeholder="0"
              className="h-8 text-sm bg-[var(--input-bg)] border-[var(--border-sheber)] text-[var(--t1)] focus:ring-[var(--a)]/20 focus:border-[var(--a)]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-[var(--t2)] uppercase tracking-wide">Высота (см)</Label>
            <Input
              type="number"
              value={item.height_cm ?? ""}
              onChange={(e) => onUpdate({ height_cm: parseInt(e.target.value) || 0 })}
              placeholder="0"
              className="h-8 text-sm bg-[var(--input-bg)] border-[var(--border-sheber)] text-[var(--t1)] focus:ring-[var(--a)]/20 focus:border-[var(--a)]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-[var(--t2)] uppercase tracking-wide">Итого</Label>
            <div className="h-8 flex items-center font-semibold text-[var(--t1)] text-base">
              {formatCurrency(lineTotal)}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-[var(--err)] hover:text-[var(--err)] hover:bg-[var(--err-bg)]"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Fabrics - Simplified Layout */}
      <div className="grid grid-cols-2 gap-4">
        {/* Curtain Fabric */}
        <div className="space-y-2">
          <Label className="text-xs text-[var(--t3)]">Ткань штор</Label>
          <FabricSelector
            label=""
            fabrics={fabrics}
            selectedId={item.curtain_fabric_id}
            onSelect={(id) => onUpdate({ curtain_fabric_id: id })}
            requiredMeters={item.curtain_fabric_meters}
          />
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.1"
              value={item.curtain_fabric_meters ?? ""}
              onChange={(e) => onUpdate({ curtain_fabric_meters: parseFloat(e.target.value) || 0 })}
              placeholder="метры"
              className="h-7 text-sm w-full bg-[var(--input-bg)] border-[var(--border-sheber)] text-[var(--t1)]"
            />
          </div>
        </div>

        {/* Tulle Fabric */}
        <div className="space-y-2">
          <Label className="text-xs text-[var(--t3)]">Тюль</Label>
          <FabricSelector
            label=""
            fabrics={fabrics}
            selectedId={item.tulle_fabric_id}
            onSelect={(id) => onUpdate({ tulle_fabric_id: id })}
            requiredMeters={item.tulle_fabric_meters}
          />
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.1"
              value={item.tulle_fabric_meters ?? ""}
              onChange={(e) => onUpdate({ tulle_fabric_meters: parseFloat(e.target.value) || 0 })}
              placeholder="метры"
              className="h-7 text-sm w-full bg-[var(--input-bg)] border-[var(--border-sheber)] text-[var(--t1)]"
            />
          </div>
        </div>
      </div>

      {/* Additional Costs Section - Sheber Style */}
      <div className="p-3 bg-[var(--bg)] rounded-[var(--r)] border border-[var(--borderl)] space-y-3">
        <div className="text-xs font-medium text-[var(--t2)] uppercase tracking-wide">Пошив, монтаж, доп. услуги</div>

        {/* Row 1: Sewing, Cornice (3 cols) */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-[var(--t3)]">Пошив (₸)</Label>
            <Input
              type="number"
              value={item.sewing_cost ?? ""}
              onChange={(e) => onUpdate({ sewing_cost: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              className="h-7 text-sm bg-[var(--card-sheber)] border-[var(--border-sheber)] text-[var(--t1)]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[var(--t3)]">Длина карниза (м)</Label>
            <Input
              type="number"
              step="0.1"
              value={item.cornice_length_m ?? ""}
              onChange={(e) => {
                const length = parseFloat(e.target.value) || 0;
                const pricePerMeter = item.cornice_price_per_meter || 0;
                onUpdate({
                  cornice_length_m: length,
                  cornice_cost: Math.round(length * pricePerMeter)
                });
              }}
              placeholder="м"
              className="h-7 text-sm bg-[var(--card-sheber)] border-[var(--border-sheber)] text-[var(--t1)]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[var(--t3)]">Цена за метр (₸/м)</Label>
            <Input
              type="number"
              value={item.cornice_price_per_meter ?? ""}
              onChange={(e) => {
                const pricePerMeter = parseFloat(e.target.value) || 0;
                const length = item.cornice_length_m || 0;
                onUpdate({
                  cornice_price_per_meter: pricePerMeter,
                  cornice_cost: Math.round(length * pricePerMeter)
                });
              }}
              placeholder="0"
              className="h-7 text-sm bg-[var(--card-sheber)] border-[var(--border-sheber)] text-[var(--t1)]"
            />
          </div>
        </div>

        {/* Row 2: Installation, Accessories, Additional Services */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-[var(--t3)]">Монтаж (₸)</Label>
            <Input
              type="number"
              value={item.installation_price ?? ""}
              onChange={(e) => onUpdate({ installation_price: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              className="h-7 text-sm bg-[var(--card-sheber)] border-[var(--border-sheber)] text-[var(--t1)]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[var(--t3)]">Аксессуары (₸)</Label>
            <Input
              type="number"
              value={item.accessories_cost ?? ""}
              onChange={(e) => onUpdate({ accessories_cost: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              className="h-7 text-sm bg-[var(--card-sheber)] border-[var(--border-sheber)] text-[var(--t1)]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[var(--t3)]">Доп. услуги (₸)</Label>
            <Input
              type="number"
              value={item.additional_services_total ?? ""}
              onChange={(e) => onUpdate({ additional_services_total: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              className="h-7 text-sm bg-[var(--card-sheber)] border-[var(--border-sheber)] text-[var(--t1)]"
            />
          </div>
        </div>

        {/* Row 3: Sewing Details */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-[var(--t3)]">Тип пошива</Label>
            <Select
              value={item.sewing_type ?? 'standard'}
              onValueChange={(value) => onUpdate({ sewing_type: value })}
            >
              <SelectTrigger className="h-7 text-xs bg-[var(--card-sheber)] border-[var(--border-sheber)] text-[var(--t1)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[var(--card-sheber)] border-[var(--border-sheber)]">
                <SelectItem value="simple" className="text-[var(--t1)] focus:bg-[var(--bg)]">Простой</SelectItem>
                <SelectItem value="standard" className="text-[var(--t1)] focus:bg-[var(--bg)]">Стандарт</SelectItem>
                <SelectItem value="european" className="text-[var(--t1)] focus:bg-[var(--bg)]">Европейский</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[var(--t3)]">Сложность</Label>
            <Select
              value={item.complexity ?? 'medium'}
              onValueChange={(value) => onUpdate({ complexity: value })}
            >
              <SelectTrigger className="h-7 text-xs bg-[var(--card-sheber)] border-[var(--border-sheber)] text-[var(--t1)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[var(--card-sheber)] border-[var(--border-sheber)]">
                <SelectItem value="simple" className="text-[var(--t1)] focus:bg-[var(--bg)]">Простая</SelectItem>
                <SelectItem value="medium" className="text-[var(--t1)] focus:bg-[var(--bg)]">Средняя</SelectItem>
                <SelectItem value="complex" className="text-[var(--t1)] focus:bg-[var(--bg)]">Сложная</SelectItem>
                <SelectItem value="premium" className="text-[var(--t1)] focus:bg-[var(--bg)]">Премиум</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[var(--t3)]">Кол-во складок</Label>
            <Input
              type="number"
              value={item.folds_count ?? ""}
              onChange={(e) => onUpdate({ folds_count: parseInt(e.target.value) || 0 })}
              placeholder="0"
              className="h-7 text-sm bg-[var(--card-sheber)] border-[var(--border-sheber)] text-[var(--t1)]"
            />
          </div>
        </div>

      </div>

      <div className="flex justify-end gap-2 pt-2">
      </div>
    </div>
  );
}

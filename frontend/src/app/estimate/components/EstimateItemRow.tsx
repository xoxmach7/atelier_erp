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
import { Trash2, Package, ShoppingCart, Globe, User, AlertCircle, CheckCircle2, Info } from "lucide-react";

interface EstimateItemRowProps {
  item: EstimateItem;
  fabrics: FabricDTO[];
  onUpdate: (updates: Partial<EstimateItem>) => void;
  onDelete: () => void;
}

export function EstimateItemRow({ item, fabrics, onUpdate, onDelete }: EstimateItemRowProps) {
  const { fabricCost, tulleCost, sewingCost, corniceCost, installationPrice, accessoriesCost, additionalServicesTotal, lineTotal } = calculateLineTotal(item, fabrics);

  const curtainFabric = fabrics.find((f) => f.id === item.curtain_fabric_id);
  const tulleFabric = fabrics.find((f) => f.id === item.tulle_fabric_id);

  // Helper to get availability status for a fabric
  const getAvailabilityStatus = (
    fabric: FabricDTO | undefined,
    requiredMeters: number,
    supplyMode: EstimateSupplyMode
  ): { text: string; color: string; icon: React.ReactNode } => {
    if (!fabric) {
      return { text: "", color: "", icon: null };
    }

    const available = parseFloat(fabric.available_meters || "0");
    const stock = parseFloat(fabric.stock_meters || "0");

    // For client_supplied - no stock relevance
    if (supplyMode === "client_supplied") {
      return {
        text: "Материал клиента",
        color: "text-slate-500",
        icon: <User className="h-3 w-3" />,
      };
    }

    // For purchase modes - informative only
    if (supplyMode === "purchase_local") {
      return {
        text: "Будет закуплено локально",
        color: "text-blue-600",
        icon: <ShoppingCart className="h-3 w-3" />,
      };
    }

    if (supplyMode === "purchase_import") {
      return {
        text: "Будет заказано",
        color: "text-blue-600",
        icon: <Globe className="h-3 w-3" />,
      };
    }

    // For in_stock - check availability
    if (supplyMode === "in_stock") {
      if (requiredMeters === 0) {
        return {
          text: `В наличии: ${available.toFixed(1)} м`,
          color: "text-slate-500",
          icon: <Info className="h-3 w-3" />,
        };
      }

      if (available >= requiredMeters) {
        return {
          text: `В наличии: ${available.toFixed(1)} м`,
          color: "text-green-600",
          icon: <CheckCircle2 className="h-3 w-3" />,
        };
      } else {
        return {
          text: `Недостаточно: доступно ${available.toFixed(1)} м`,
          color: "text-amber-600",
          icon: <AlertCircle className="h-3 w-3" />,
        };
      }
    }

    return { text: "", color: "", icon: null };
  };

  const curtainAvailability = getAvailabilityStatus(
    curtainFabric,
    item.curtain_fabric_meters,
    item.curtain_supply_mode
  );

  const tulleAvailability = getAvailabilityStatus(
    tulleFabric,
    item.tulle_fabric_meters,
    item.tulle_supply_mode
  );

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
              value={item.width_cm || ""}
              onChange={(e) => onUpdate({ width_cm: parseInt(e.target.value) || 0 })}
              placeholder="0"
              className="h-8 text-sm bg-[var(--input-bg)] border-[var(--border-sheber)] text-[var(--t1)] focus:ring-[var(--a)]/20 focus:border-[var(--a)]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-[var(--t2)] uppercase tracking-wide">Высота (см)</Label>
            <Input
              type="number"
              value={item.height_cm || ""}
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
              value={item.curtain_fabric_meters || ""}
              onChange={(e) => onUpdate({ curtain_fabric_meters: parseFloat(e.target.value) || 0 })}
              placeholder="метры"
              className="h-7 text-sm w-24 bg-[var(--input-bg)] border-[var(--border-sheber)] text-[var(--t1)]"
            />
            {curtainFabric && (
              <span className="text-xs text-[var(--t2)]">{formatCurrency(fabricCost)}</span>
            )}
          </div>
          <Select
            value={item.curtain_supply_mode || 'in_stock'}
            onValueChange={(value: EstimateSupplyMode) => onUpdate({ curtain_supply_mode: value })}
          >
            <SelectTrigger className="h-7 text-xs bg-[var(--input-bg)] border-[var(--border-sheber)] text-[var(--t1)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[var(--card-sheber)] border-[var(--border-sheber)]">
              <SelectItem value="in_stock" className="text-[var(--t1)]"><span className="flex items-center gap-2"><Package className="h-3 w-3 text-[var(--ok)]"/>На складе</span></SelectItem>
              <SelectItem value="purchase_local" className="text-[var(--t1)]"><span className="flex items-center gap-2"><ShoppingCart className="h-3 w-3 text-[var(--a)]"/>Закупить локально</span></SelectItem>
              <SelectItem value="purchase_import" className="text-[var(--t1)]"><span className="flex items-center gap-2"><Globe className="h-3 w-3 text-[var(--pur)]"/>Закупить импорт</span></SelectItem>
              <SelectItem value="client_supplied" className="text-[var(--t1)]"><span className="flex items-center gap-2"><User className="h-3 w-3 text-[var(--t3)]"/>Клиентский</span></SelectItem>
            </SelectContent>
          </Select>
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
              value={item.tulle_fabric_meters || ""}
              onChange={(e) => onUpdate({ tulle_fabric_meters: parseFloat(e.target.value) || 0 })}
              placeholder="метры"
              className="h-7 text-sm w-24 bg-[var(--input-bg)] border-[var(--border-sheber)] text-[var(--t1)]"
            />
            {tulleFabric && (
              <span className="text-xs text-[var(--t2)]">{formatCurrency(tulleCost)}</span>
            )}
          </div>
          <Select
            value={item.tulle_supply_mode || 'in_stock'}
            onValueChange={(value: EstimateSupplyMode) => onUpdate({ tulle_supply_mode: value })}
          >
            <SelectTrigger className="h-7 text-xs bg-[var(--input-bg)] border-[var(--border-sheber)] text-[var(--t1)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[var(--card-sheber)] border-[var(--border-sheber)]">
              <SelectItem value="in_stock" className="text-[var(--t1)]"><span className="flex items-center gap-2"><Package className="h-3 w-3 text-[var(--ok)]"/>На складе</span></SelectItem>
              <SelectItem value="purchase_local" className="text-[var(--t1)]"><span className="flex items-center gap-2"><ShoppingCart className="h-3 w-3 text-[var(--a)]"/>Закупить локально</span></SelectItem>
              <SelectItem value="purchase_import" className="text-[var(--t1)]"><span className="flex items-center gap-2"><Globe className="h-3 w-3 text-[var(--pur)]"/>Закупить импорт</span></SelectItem>
              <SelectItem value="client_supplied" className="text-[var(--t1)]"><span className="flex items-center gap-2"><User className="h-3 w-3 text-[var(--t3)]"/>Клиентский</span></SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Additional Costs Section - Sheber Style */}
      <div className="p-3 bg-[var(--bg)] rounded-[var(--r)] border border-[var(--borderl)] space-y-3">
        <div className="text-xs font-medium text-[var(--t2)] uppercase tracking-wide">Пошив, монтаж, доп. услуги</div>

        {/* Row 1: Sewing, Cornice, Installation */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-[var(--t3)]">Пошив (₸)</Label>
            <Input
              type="number"
              value={item.sewing_cost || ""}
              onChange={(e) => onUpdate({ sewing_cost: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              className="h-7 text-sm bg-[var(--card-sheber)] border-[var(--border-sheber)] text-[var(--t1)]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[var(--t3)]">Карниз: длина (м)</Label>
            <Input
              type="number"
              step="0.1"
              value={item.cornice_length_m || ""}
              onChange={(e) => onUpdate({ cornice_length_m: parseFloat(e.target.value) || 0 })}
              placeholder="м"
              className="h-7 text-sm bg-[var(--card-sheber)] border-[var(--border-sheber)] text-[var(--t1)]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[var(--t3)]">Карниз: стоимость (₸)</Label>
            <Input
              type="number"
              value={item.cornice_cost || ""}
              onChange={(e) => onUpdate({ cornice_cost: parseFloat(e.target.value) || 0 })}
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
              value={item.installation_price || ""}
              onChange={(e) => onUpdate({ installation_price: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              className="h-7 text-sm bg-[var(--card-sheber)] border-[var(--border-sheber)] text-[var(--t1)]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[var(--t3)]">Аксессуары (₸)</Label>
            <Input
              type="number"
              value={item.accessories_cost || ""}
              onChange={(e) => onUpdate({ accessories_cost: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              className="h-7 text-sm bg-[var(--card-sheber)] border-[var(--border-sheber)] text-[var(--t1)]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[var(--t3)]">Доп. услуги (₸)</Label>
            <Input
              type="number"
              value={item.additional_services_total || ""}
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
              value={item.sewing_type || 'standard'}
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
              value={item.complexity || 'medium'}
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
              value={item.folds_count || ""}
              onChange={(e) => onUpdate({ folds_count: parseInt(e.target.value) || 0 })}
              placeholder="0"
              className="h-7 text-sm bg-[var(--card-sheber)] border-[var(--border-sheber)] text-[var(--t1)]"
            />
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="pt-2 border-t border-[var(--borderl)]">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span className="text-[var(--t3)]">Ткань: <span className="text-[var(--t1)]">{formatCurrency(fabricCost)}</span></span>
            <span className="text-[var(--t3)]">Тюль: <span className="text-[var(--t1)]">{formatCurrency(tulleCost)}</span></span>
            <span className="text-[var(--t3)]">Пошив: <span className="text-[var(--t1)]">{formatCurrency(sewingCost)}</span></span>
            <span className="text-[var(--t3)]">Карниз: <span className="text-[var(--t1)]">{formatCurrency(corniceCost)}</span></span>
            <span className="text-[var(--t3)]">Монтаж: <span className="text-[var(--t1)]">{formatCurrency(installationPrice)}</span></span>
            <span className="text-[var(--t3)]">Аксессуары: <span className="text-[var(--t1)]">{formatCurrency(accessoriesCost)}</span></span>
            <span className="text-[var(--t3)]">Доп. услуги: <span className="text-[var(--t1)]">{formatCurrency(additionalServicesTotal)}</span></span>
            <span className="font-semibold text-[var(--a)] ml-auto">Итого: {formatCurrency(lineTotal)}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
      </div>
    </div>
  );
}

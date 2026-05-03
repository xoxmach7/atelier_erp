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
    <div className="border rounded-lg p-4 space-y-4 bg-white">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 grid grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Название проёма</Label>
            <Input
              value={item.window_name}
              onChange={(e) => onUpdate({ window_name: e.target.value })}
              placeholder="e.g., Окно 1, Дверь"
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
            <Label className="text-xs">Итого по позиции</Label>
            <div className="h-8 flex items-center font-semibold text-slate-900">
              {formatCurrency(lineTotal)}
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
            label="Ткань штор"
            fabrics={fabrics}
            selectedId={item.curtain_fabric_id}
            onSelect={(id) => onUpdate({ curtain_fabric_id: id })}
            requiredMeters={item.curtain_fabric_meters}
          />
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Метры:</Label>
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
              <span className="text-xs text-slate-500">= {formatCurrency(fabricCost)}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Поставка:</Label>
            <Select
              value={item.curtain_supply_mode || 'in_stock'}
              onValueChange={(value: EstimateSupplyMode) =>
                onUpdate({ curtain_supply_mode: value })
              }
            >
              <SelectTrigger className="h-7 text-xs w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_stock">
                  <div className="flex items-center gap-2">
                    <Package className="h-3 w-3" />
                    <span>На складе</span>
                  </div>
                </SelectItem>
                <SelectItem value="purchase_local">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-3 w-3" />
                    <span>Закупить (локально)</span>
                  </div>
                </SelectItem>
                <SelectItem value="purchase_import">
                  <div className="flex items-center gap-2">
                    <Globe className="h-3 w-3" />
                    <span>Закупить (импорт)</span>
                  </div>
                </SelectItem>
                <SelectItem value="client_supplied">
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3" />
                    <span>Клиентский</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {curtainFabric && curtainAvailability.text && (
            <div className={`flex items-center gap-1 text-xs ${curtainAvailability.color}`}>
              {curtainAvailability.icon}
              <span>{curtainAvailability.text}</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <FabricSelector
            label="Ткань тюль"
            fabrics={fabrics}
            selectedId={item.tulle_fabric_id}
            onSelect={(id) => onUpdate({ tulle_fabric_id: id })}
            requiredMeters={item.tulle_fabric_meters}
          />
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Метры:</Label>
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
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Поставка:</Label>
            <Select
              value={item.tulle_supply_mode || 'in_stock'}
              onValueChange={(value: EstimateSupplyMode) =>
                onUpdate({ tulle_supply_mode: value })
              }
            >
              <SelectTrigger className="h-7 text-xs w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_stock">
                  <div className="flex items-center gap-2">
                    <Package className="h-3 w-3" />
                    <span>На складе</span>
                  </div>
                </SelectItem>
                <SelectItem value="purchase_local">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-3 w-3" />
                    <span>Закупить (локально)</span>
                  </div>
                </SelectItem>
                <SelectItem value="purchase_import">
                  <div className="flex items-center gap-2">
                    <Globe className="h-3 w-3" />
                    <span>Закупить (импорт)</span>
                  </div>
                </SelectItem>
                <SelectItem value="client_supplied">
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3" />
                    <span>Клиентский</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {tulleFabric && tulleAvailability.text && (
            <div className={`flex items-center gap-1 text-xs ${tulleAvailability.color}`}>
              {tulleAvailability.icon}
              <span>{tulleAvailability.text}</span>
            </div>
          )}
        </div>
      </div>

      {/* Additional Costs Section */}
      <div className="border-t pt-4 mt-2">
        <div className="text-xs font-medium text-slate-500 mb-3">Дополнительные расходы</div>
        <div className="grid grid-cols-4 gap-4">
          {/* Sewing */}
          <div className="space-y-2">
            <Label className="text-xs">Пошив (₸)</Label>
            <Input
              type="number"
              value={item.sewing_cost || ""}
              onChange={(e) => onUpdate({ sewing_cost: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              className="h-7 text-sm"
            />
          </div>
          {/* Cornice */}
          <div className="space-y-2">
            <Label className="text-xs">Карниз: длина (м)</Label>
            <Input
              type="number"
              step="0.1"
              value={item.cornice_length_m || ""}
              onChange={(e) => onUpdate({ cornice_length_m: parseFloat(e.target.value) || 0 })}
              placeholder="м"
              className="h-7 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Карниз: стоимость (₸)</Label>
            <Input
              type="number"
              value={item.cornice_cost || ""}
              onChange={(e) => onUpdate({ cornice_cost: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              className="h-7 text-sm"
            />
          </div>
          {/* Installation */}
          <div className="space-y-2">
            <Label className="text-xs">Монтаж (₸)</Label>
            <Input
              type="number"
              value={item.installation_price || ""}
              onChange={(e) => onUpdate({ installation_price: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              className="h-7 text-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4 mt-3">
          {/* Accessories */}
          <div className="space-y-2">
            <Label className="text-xs">Аксессуары (₸)</Label>
            <Input
              type="number"
              value={item.accessories_cost || ""}
              onChange={(e) => onUpdate({ accessories_cost: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              className="h-7 text-sm"
            />
          </div>
          {/* Additional Services */}
          <div className="space-y-2">
            <Label className="text-xs">Доп. услуги (₸)</Label>
            <Input
              type="number"
              value={item.additional_services_total || ""}
              onChange={(e) => onUpdate({ additional_services_total: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              className="h-7 text-sm"
            />
          </div>
          {/* Folds Count */}
          <div className="space-y-2">
            <Label className="text-xs">Кол-во складок</Label>
            <Input
              type="number"
              value={item.folds_count || ""}
              onChange={(e) => onUpdate({ folds_count: parseInt(e.target.value) || 0 })}
              placeholder="0"
              className="h-7 text-sm"
            />
          </div>
          {/* Sewing Type */}
          <div className="space-y-2">
            <Label className="text-xs">Тип пошива</Label>
            <Select
              value={item.sewing_type || 'standard'}
              onValueChange={(value) => onUpdate({ sewing_type: value })}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simple">Простой</SelectItem>
                <SelectItem value="standard">Стандарт</SelectItem>
                <SelectItem value="european">Европейский</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4 mt-3">
          {/* Complexity */}
          <div className="space-y-2">
            <Label className="text-xs">Сложность</Label>
            <Select
              value={item.complexity || 'medium'}
              onValueChange={(value) => onUpdate({ complexity: value })}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simple">Простая</SelectItem>
                <SelectItem value="medium">Средняя</SelectItem>
                <SelectItem value="complex">Сложная</SelectItem>
                <SelectItem value="premium">Премиум</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Cost Breakdown Display */}
          <div className="col-span-3 space-y-1 text-xs text-slate-500">
            <div className="flex justify-between">
              <span>Ткань: {formatCurrency(fabricCost)}</span>
              <span>Тюль: {formatCurrency(tulleCost)}</span>
              <span>Пошив: {formatCurrency(sewingCost)}</span>
              <span>Карниз: {formatCurrency(corniceCost)}</span>
            </div>
            <div className="flex justify-between">
              <span>Монтаж: {formatCurrency(installationPrice)}</span>
              <span>Аксессуары: {formatCurrency(accessoriesCost)}</span>
              <span>Доп. услуги: {formatCurrency(additionalServicesTotal)}</span>
              <span className="font-semibold text-slate-900">Итого: {formatCurrency(lineTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
      </div>
    </div>
  );
}

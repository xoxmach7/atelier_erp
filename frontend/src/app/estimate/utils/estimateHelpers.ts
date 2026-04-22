/**
 * Estimate Helper Functions
 * Pure utility functions for calculations and formatting
 */

import type { FabricDTO, EstimateItem, EstimateRoom } from "@/types";

export function formatCurrency(value: number): string {
  return `₸ ${value.toLocaleString()}`;
}

export function formatMeters(value: number): string {
  return `${value.toFixed(1)} м`;
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export interface LineTotalResult {
  curtainCost: number;
  tulleCost: number;
  total: number;
}

export function calculateLineTotal(
  item: EstimateItem,
  fabrics: FabricDTO[]
): LineTotalResult {
  const curtainFabric = fabrics.find((f) => f.id === item.curtain_fabric_id);
  const tulleFabric = fabrics.find((f) => f.id === item.tulle_fabric_id);

  const curtainCost = curtainFabric
    ? parseFloat(curtainFabric.price_per_meter) * item.curtain_fabric_meters
    : 0;
  const tulleCost = tulleFabric
    ? parseFloat(tulleFabric.price_per_meter) * item.tulle_fabric_meters
    : 0;

  return {
    curtainCost,
    tulleCost,
    total: curtainCost + tulleCost,
  };
}

export interface RoomTotalResult {
  roomTotal: number;
  itemCount: number;
}

export function calculateRoomTotal(
  room: EstimateRoom,
  fabrics: FabricDTO[]
): RoomTotalResult {
  let roomTotal = 0;
  let itemCount = room.items.length;

  room.items.forEach((item) => {
    const { total } = calculateLineTotal(item, fabrics);
    roomTotal += total;
  });

  return { roomTotal, itemCount };
}

export interface FabricRequirement {
  id: string;
  name: string;
  required: number;
  available: number;
  type: "Curtain" | "Tulle";
}

export interface EstimateSummaryResult {
  totalCurtainCost: number;
  totalTulleCost: number;
  totalCost: number;
  itemCount: number;
  warnings: string[];
  fabricRequirements: Record<string, FabricRequirement>;
}

export function calculateEstimateSummary(
  rooms: EstimateRoom[],
  fabrics: FabricDTO[]
): EstimateSummaryResult {
  let totalCurtainCost = 0;
  let totalTulleCost = 0;
  let itemCount = 0;
  const warnings: string[] = [];
  const fabricRequirements: Record<string, FabricRequirement> = {};

  rooms.forEach((room) => {
    room.items.forEach((item) => {
      itemCount++;

      if (item.curtain_fabric_id) {
        const fabric = fabrics.find((f) => f.id === item.curtain_fabric_id);
        if (fabric) {
          const cost = parseFloat(fabric.price_per_meter) * item.curtain_fabric_meters;
          totalCurtainCost += cost;

          if (!fabricRequirements[fabric.id]) {
            fabricRequirements[fabric.id] = {
              id: fabric.id,
              name: fabric.name,
              required: 0,
              available: parseFloat(fabric.available_meters),
              type: "Curtain",
            };
          }
          fabricRequirements[fabric.id].required += item.curtain_fabric_meters;
        }
      }

      if (item.tulle_fabric_id) {
        const fabric = fabrics.find((f) => f.id === item.tulle_fabric_id);
        if (fabric) {
          const cost = parseFloat(fabric.price_per_meter) * item.tulle_fabric_meters;
          totalTulleCost += cost;

          if (!fabricRequirements[fabric.id]) {
            fabricRequirements[fabric.id] = {
              id: fabric.id,
              name: fabric.name,
              required: 0,
              available: parseFloat(fabric.available_meters),
              type: "Tulle",
            };
          }
          fabricRequirements[fabric.id].required += item.tulle_fabric_meters;
        }
      }
    });
  });

  // Check for insufficient stock
  Object.entries(fabricRequirements).forEach(([, req]) => {
    if (req.required > req.available) {
      warnings.push(
        `${req.name}: need ${formatMeters(req.required)}, have ${formatMeters(req.available)}`
      );
    }
  });

  return {
    totalCurtainCost,
    totalTulleCost,
    totalCost: totalCurtainCost + totalTulleCost,
    itemCount,
    warnings,
    fabricRequirements,
  };
}

export function hasEnoughStock(
  fabric: FabricDTO | undefined,
  requiredMeters: number
): boolean {
  if (!fabric) return true;
  return parseFloat(fabric.available_meters) >= requiredMeters;
}

"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { FabricDTO, EstimateRoom, EstimateItem } from "@/types";
import { EstimateItemRow } from "./EstimateItemRow";
import { formatCurrency, calculateRoomTotal } from "../utils/estimateHelpers";
import { Home, Trash2, Plus } from "lucide-react";

interface RoomSectionProps {
  room: EstimateRoom;
  fabrics: FabricDTO[];
  onUpdate: (updates: Partial<EstimateRoom>) => void;
  onDelete: () => void;
  onAddItem: () => void;
  onUpdateItem: (itemId: string, updates: Partial<EstimateItem>) => void;
  onDeleteItem: (itemId: string) => void;
}

export function RoomSection({
  room,
  fabrics,
  onUpdate,
  onDelete,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
}: RoomSectionProps) {
  const { roomTotal } = useMemo(
    () => calculateRoomTotal(room, fabrics),
    [room, fabrics]
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Home className="h-5 w-5 text-slate-500" />
            <Input
              value={room.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="font-semibold text-lg border-0 p-0 h-auto focus-visible:ring-0 w-48"
            />
            <span className="text-sm text-slate-500">({room.items.length} items)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-semibold">{formatCurrency(roomTotal)}</span>
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-600">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {room.items.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-4">
            No items yet. Add your first window or position.
          </div>
        ) : (
          room.items.map((item) => (
            <EstimateItemRow
              key={item.id}
              item={item}
              fabrics={fabrics}
              onUpdate={(updates) => onUpdateItem(item.id, updates)}
              onDelete={() => onDeleteItem(item.id)}
            />
          ))
        )}
        <Button variant="outline" size="sm" onClick={onAddItem} className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Add Item to {room.name}
        </Button>
      </CardContent>
    </Card>
  );
}

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
    <Card className="bg-[var(--card-sheber)] border-[var(--border-sheber)] shadow-[var(--sh)] rounded-[var(--rl)] overflow-hidden">
      <CardHeader className="pb-3 border-b border-[var(--borderl)] bg-[var(--bg)]/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[var(--r)] bg-[var(--al)] flex items-center justify-center">
              <Home className="h-4 w-4 text-[var(--a)]" />
            </div>
            <Input
              value={room.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="font-semibold text-[var(--t1)] text-lg border-0 p-0 h-auto focus-visible:ring-0 w-48 bg-transparent"
            />
            <span className="text-sm text-[var(--t3)]">({room.items.length} позиций)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-semibold text-[var(--t1)]">{formatCurrency(roomTotal)}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="text-[var(--err)] hover:text-[var(--err)] hover:bg-[var(--err-bg)]"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {room.items.length === 0 ? (
          <div className="text-sm text-[var(--t3)] text-center py-6 bg-[var(--bg)] rounded-[var(--r)]">
            Пока нет позиций. Добавьте первое окно или позицию.
          </div>
        ) : (
          <div className="space-y-4">
            {room.items.map((item) => (
              <EstimateItemRow
                key={item.id}
                item={item}
                fabrics={fabrics}
                onUpdate={(updates) => onUpdateItem(item.id, updates)}
                onDelete={() => onDeleteItem(item.id)}
              />
            ))}
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onAddItem}
          className="w-full border-[var(--border-sheber)] text-[var(--t2)] hover:bg-[var(--bg)] hover:text-[var(--a)] hover:border-[var(--a)]"
        >
          <Plus className="mr-2 h-4 w-4" />
          Добавить позицию в {room.name}
        </Button>
      </CardContent>
    </Card>
  );
}

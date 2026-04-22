"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MeasurementRoom, MeasurementItem } from "@/types";
import { Plus, Trash2, Home } from "lucide-react";
import { MeasurementItemForm } from "./MeasurementItemForm";
import { generateId } from "../utils/measurementHelpers";

interface RoomSectionProps {
  room: MeasurementRoom;
  onChange: (updates: Partial<MeasurementRoom>) => void;
  onDelete: () => void;
}

export function RoomSection({ room, onChange, onDelete }: RoomSectionProps) {
  const addItem = () => {
    const newItem: MeasurementItem = {
      id: generateId(),
      name: `Окно ${room.items.length + 1}`,
      width_cm: 0,
      height_cm: 0,
      mounting_type: "",
      cornice_type: "",
      is_electric_cornice: false,
      needs_electrical_access: false,
      installation_complexity: "standard",
      notes: "",
    };
    onChange({ items: [...room.items, newItem] });
  };

  const updateItem = (itemId: string, updates: Partial<MeasurementItem>) => {
    onChange({
      items: room.items.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item
      ),
    });
  };

  const deleteItem = (itemId: string) => {
    onChange({
      items: room.items.filter((item) => item.id !== itemId),
    });
  };

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Home className="h-4 w-4 text-slate-400" />
            <Input
              value={room.name}
              onChange={(e) => onChange({ name: e.target.value })}
              className="w-48 h-8 text-base font-medium border-0 bg-transparent p-0 focus-visible:ring-0"
              placeholder="Название комнаты"
            />
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4 mr-1" />
              Добавить окно
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {room.items.length === 0 ? (
          <div className="text-center py-6 text-slate-500 bg-slate-50 rounded-lg">
            <p className="text-sm">Нет окон в этой комнате</p>
            <Button variant="link" size="sm" onClick={addItem}>
              Добавить первое окно
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {room.items.map((item) => (
              <MeasurementItemForm
                key={item.id}
                item={item}
                onChange={(updates) => updateItem(item.id, updates)}
                onDelete={() => deleteItem(item.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

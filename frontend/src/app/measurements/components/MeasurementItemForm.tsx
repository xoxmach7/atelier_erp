"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MeasurementItem, MountingType, CorniceType, InstallationComplexity } from "@/types";
import { Trash2, Ruler } from "lucide-react";
import {
  getMountingTypeLabel,
  getCorniceTypeLabel,
  getComplexityLabel,
  formatDimensions,
} from "../utils/measurementHelpers";

interface MeasurementItemFormProps {
  item: MeasurementItem;
  onChange: (updates: Partial<MeasurementItem>) => void;
  onDelete: () => void;
}

const MOUNTING_TYPES: MountingType[] = ["ceiling", "wall", "niche", "window_recess", ""];
const CORNICE_TYPES: CorniceType[] = ["standard", "hidden", "electric", "none", ""];
const COMPLEXITY_LEVELS: InstallationComplexity[] = ["standard", "complex", "very_complex"];

export function MeasurementItemForm({
  item,
  onChange,
  onDelete,
}: MeasurementItemFormProps) {
  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Ruler className="h-4 w-4 text-slate-400" />
            <Input
              value={item.name}
              onChange={(e) => onChange({ name: e.target.value })}
              className="w-48 h-7 text-sm font-medium border-0 bg-transparent p-0 focus-visible:ring-0"
              placeholder="Название (например, Окно 1)"
            />
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dimensions */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`width-${item.id}`}>Ширина (см)</Label>
            <Input
              id={`width-${item.id}`}
              type="number"
              min={0}
              max={1000}
              value={item.width_cm || ""}
              onChange={(e) => onChange({ width_cm: parseInt(e.target.value) || 0 })}
              placeholder="100"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`height-${item.id}`}>Высота (см)</Label>
            <Input
              id={`height-${item.id}`}
              type="number"
              min={0}
              max={500}
              value={item.height_cm || ""}
              onChange={(e) => onChange({ height_cm: parseInt(e.target.value) || 0 })}
              placeholder="200"
            />
          </div>
        </div>

        {/* Optional dimensions */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`depth-${item.id}`}>Глубина (см, опц.)</Label>
            <Input
              id={`depth-${item.id}`}
              type="number"
              min={0}
              value={item.depth_cm || ""}
              onChange={(e) =>
                onChange({ depth_cm: e.target.value ? parseInt(e.target.value) : undefined })
              }
              placeholder="-"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`ceiling-${item.id}`}>Высота потолка (см, опц.)</Label>
            <Input
              id={`ceiling-${item.id}`}
              type="number"
              min={0}
              value={item.ceiling_height_cm || ""}
              onChange={(e) =>
                onChange({
                  ceiling_height_cm: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
              placeholder="-"
            />
          </div>
        </div>

        {/* Mounting and Cornice */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Тип крепления</Label>
            <Select
              value={item.mounting_type}
              onValueChange={(value: MountingType) => onChange({ mounting_type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите тип" />
              </SelectTrigger>
              <SelectContent>
                {MOUNTING_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {getMountingTypeLabel(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Тип карниза</Label>
            <Select
              value={item.cornice_type}
              onValueChange={(value: CorniceType) => onChange({ cornice_type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите тип" />
              </SelectTrigger>
              <SelectContent>
                {CORNICE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {getCorniceTypeLabel(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Complexity */}
        <div className="space-y-2">
          <Label>Сложность установки</Label>
          <Select
            value={item.installation_complexity}
            onValueChange={(value: InstallationComplexity) =>
              onChange({ installation_complexity: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMPLEXITY_LEVELS.map((level) => (
                <SelectItem key={level} value={level}>
                  {getComplexityLabel(level)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Checkboxes */}
        <div className="flex gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`electric-${item.id}`}
              checked={item.is_electric_cornice}
              onCheckedChange={(checked: boolean | "indeterminate") =>
                onChange({ is_electric_cornice: checked === true })
              }
            />
            <Label htmlFor={`electric-${item.id}`} className="text-sm font-normal">
              Электрокарниз
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`access-${item.id}`}
              checked={item.needs_electrical_access}
              onCheckedChange={(checked: boolean | "indeterminate") =>
                onChange({ needs_electrical_access: checked === true })
              }
            />
            <Label htmlFor={`access-${item.id}`} className="text-sm font-normal">
              Нужен доступ к электрике
            </Label>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor={`notes-${item.id}`}>Примечания</Label>
          <Textarea
            id={`notes-${item.id}`}
            value={item.notes}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange({ notes: e.target.value })}
            placeholder="Особенности, препятствия, пожелания..."
            rows={2}
          />
        </div>
      </CardContent>
    </Card>
  );
}

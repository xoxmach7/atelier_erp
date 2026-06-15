"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useFabrics } from "@/hooks/useFabrics";
import { useCreateMeasurement } from "@/hooks/useMeasurements";
import { MOUNTING_OPTIONS } from "@/lib/mounting-types";
import type { MeasurementDTO } from "@/types";

/* ------------------------------------------------------------------ */
/*  Props                                                               */
/* ------------------------------------------------------------------ */

interface CreateMeasurementModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  onSuccess?: (measurement: MeasurementDTO) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export function CreateMeasurementModal({
  isOpen,
  onClose,
  orderId,
  onSuccess,
}: CreateMeasurementModalProps) {
  // Form state
  const [roomName, setRoomName] = useState("");
  const [windowName, setWindowName] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [curtainFabricId, setCurtainFabricId] = useState("");
  const [curtainMeters, setCurtainMeters] = useState("");
  const [tulleFabricId, setTulleFabricId] = useState("");
  const [tulleMeters, setTulleMeters] = useState("");
  const [mountingType, setMountingType] = useState("");
  const [notes, setNotes] = useState("");

  // Data hooks
  const { data: fabricsData } = useFabrics({ pageSize: 100, isActive: true });
  const fabrics = fabricsData?.results ?? [];

  const createMutation = useCreateMeasurement();

  // Validation
  const isValid = roomName.trim() && windowName.trim() && widthCm && heightCm;

  // Reset form
  const resetForm = () => {
    setRoomName("");
    setWindowName("");
    setWidthCm("");
    setHeightCm("");
    setCurtainFabricId("");
    setCurtainMeters("");
    setTulleFabricId("");
    setTulleMeters("");
    setMountingType("");
    setNotes("");
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    try {
      const result = await createMutation.mutateAsync({
        order: orderId,
        room_name: roomName.trim(),
        window_name: windowName.trim(),
        width_cm: parseInt(widthCm),
        height_cm: parseInt(heightCm),
        depth_cm: null,
        ceiling_height_cm: null,
        mounting_type: mountingType || "",
        window_type: "",
        has_radiator: false,
        has_slope: false,
        obstacles: "",
        selected_fabric: null,
        selected_cornice_type: "",
        curtain_fabric: curtainFabricId || null,
        curtain_meters: curtainMeters ? parseFloat(curtainMeters) : 0,
        tulle_fabric: tulleFabricId || null,
        tulle_meters: tulleMeters ? parseFloat(tulleMeters) : 0,
        measured_by: null,
        notes: notes.trim(),
      });
      onSuccess?.(result);
      resetForm();
      onClose();
    } catch {
      // Error is handled by mutation state
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
      onClose();
    }
  };

  /* Shared input class matching Figma gray bg */
  const inputCls =
    "h-11 border-none bg-[#E9E9E9] rounded-[var(--r)] text-[14px] text-[var(--t1)] placeholder:text-[var(--t3)] focus-visible:ring-[var(--a)]/30";
  const selectTriggerCls =
    "h-11 border-none bg-[#E9E9E9] rounded-[var(--r)] text-[14px] text-[var(--t1)] focus:ring-[var(--a)]/30";

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-0 gap-0 overflow-auto max-h-[90vh]">
        <div className="px-8 pt-7 pb-8">
          {/* Header */}
          <DialogHeader className="mb-7">
            <DialogTitle className="text-[24px] font-bold text-[var(--t1)]">
              Создание замера
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-[18px]">
            {/* 1. Комната */}
            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium text-[var(--t1)]">
                1. Комната <span className="text-[#DC2626]">*</span>
              </Label>
              <Input
                className={inputCls}
                placeholder="Например: Гостиная"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                required
              />
            </div>

            {/* 2. Окно/изделие */}
            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium text-[var(--t1)]">
                2. Окно/изделие <span className="text-[#DC2626]">*</span>
              </Label>
              <Input
                className={inputCls}
                placeholder="Например: Окно 1"
                value={windowName}
                onChange={(e) => setWindowName(e.target.value)}
                required
              />
            </div>

            {/* 3 & 4. Ширина / Высота */}
            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label className="text-[13px] font-medium text-[var(--t1)]">
                  3. Ширина (см) <span className="text-[#DC2626]">*</span>
                </Label>
                <Input
                  className={inputCls}
                  type="number"
                  min={1}
                  value={widthCm}
                  onChange={(e) => setWidthCm(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] font-medium text-[var(--t1)]">
                  4. Высота (см) <span className="text-[#DC2626]">*</span>
                </Label>
                <Input
                  className={inputCls}
                  type="number"
                  min={1}
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* 5. Ткань штор */}
            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium text-[var(--t1)]">
                5. Ткань штор
              </Label>
              <div className="flex items-center gap-2.5">
                <Select
                  value={curtainFabricId}
                  onValueChange={setCurtainFabricId}
                >
                  <SelectTrigger className={`flex-1 ${selectTriggerCls}`}>
                    <SelectValue placeholder="Выберите ткань" />
                  </SelectTrigger>
                  <SelectContent>
                    {fabrics.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                        {f.hanger_number ? ` (${f.hanger_number})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-[13px] text-[var(--t3)] shrink-0">
                  метры
                </span>
                <Input
                  className={`${inputCls} w-[72px] text-center shrink-0`}
                  type="number"
                  min={0}
                  step={0.1}
                  value={curtainMeters}
                  onChange={(e) => setCurtainMeters(e.target.value)}
                />
              </div>
            </div>

            {/* 6. Ткань тюля */}
            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium text-[var(--t1)]">
                6. Ткань тюля
              </Label>
              <div className="flex items-center gap-2.5">
                <Select
                  value={tulleFabricId}
                  onValueChange={setTulleFabricId}
                >
                  <SelectTrigger className={`flex-1 ${selectTriggerCls}`}>
                    <SelectValue placeholder="Выберите тюль" />
                  </SelectTrigger>
                  <SelectContent>
                    {fabrics.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                        {f.hanger_number ? ` (${f.hanger_number})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-[13px] text-[var(--t3)] shrink-0">
                  метры
                </span>
                <Input
                  className={`${inputCls} w-[72px] text-center shrink-0`}
                  type="number"
                  min={0}
                  step={0.1}
                  value={tulleMeters}
                  onChange={(e) => setTulleMeters(e.target.value)}
                />
              </div>
            </div>

            {/* 7. Тип крепления */}
            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium text-[var(--t1)]">
                7. Тип крепления
              </Label>
              <Select value={mountingType} onValueChange={setMountingType}>
                <SelectTrigger className={selectTriggerCls}>
                  <SelectValue placeholder="Выберите крепление" />
                </SelectTrigger>
                <SelectContent>
                  {MOUNTING_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 8. Комментарии */}
            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium text-[var(--t1)]">
                8. Комментарии по изделию
              </Label>
              <Input
                className={inputCls}
                placeholder="Примечание"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={!isValid || createMutation.isPending}
              className="w-full h-12 bg-[var(--a)] hover:bg-[var(--ad)] text-white text-[15px] font-semibold rounded-[var(--r)] mt-1 disabled:opacity-50"
            >
              {createMutation.isPending ? "Создание..." : "Создать"}
            </Button>

            {/* Error */}
            {createMutation.isError && (
              <p className="text-[13px] text-[#DC2626] text-center">
                {createMutation.error?.message || "Не удалось создать замер"}
              </p>
            )}
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

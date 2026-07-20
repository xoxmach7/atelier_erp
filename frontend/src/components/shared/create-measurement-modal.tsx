"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModalCloseX } from "./modal-close";
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
import { useQuery } from "@tanstack/react-query";
import { useFabrics } from "@/hooks/useFabrics";
import { useCreateMeasurement, useUpdateMeasurement } from "@/hooks/useMeasurements";
import { fetchInventoryItems } from "@/services/http/inventory-items";
import type { MeasurementDTO } from "@/types";

/* ------------------------------------------------------------------ */
/*  Props                                                               */
/* ------------------------------------------------------------------ */

interface CreateMeasurementModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  /** Если передан — модалка работает в режиме редактирования. */
  measurement?: MeasurementDTO | null;
  onSuccess?: (measurement: MeasurementDTO) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export function CreateMeasurementModal(props: CreateMeasurementModalProps) {
  // Remount on open (and when switching which measurement is being edited) so
  // form state always starts fresh/prefilled without a setState-in-effect reset.
  const modalKey = props.isOpen ? (props.measurement?.id ?? "new") : "closed";
  return <CreateMeasurementModalInner key={modalKey} {...props} />;
}

function CreateMeasurementModalInner({
  isOpen,
  onClose,
  orderId,
  measurement,
  onSuccess,
}: CreateMeasurementModalProps) {
  // Form state. Поле «Окно/изделие» слито с «Комнатой» (2026-07-20, по
  // запросу владельца): раздельные текстовые поля путали пользователей и
  // легко расходились (опечатка в одном из двух — и сопоставление
  // замер↔позиция после КП переставало работать). window_name на бэке
  // остался (участвует в сопоставлении), но заполняется тем же текстом,
  // что и room_name — отдельно его больше никто не вводит.
  const [roomName, setRoomName] = useState(measurement?.room_name || "");
  const [widthCm, setWidthCm] = useState(measurement?.width_cm != null ? String(measurement.width_cm) : "");
  const [heightCm, setHeightCm] = useState(measurement?.height_cm != null ? String(measurement.height_cm) : "");
  const [curtainFabricId, setCurtainFabricId] = useState(measurement?.curtain_fabric || "");
  const [curtainMeters, setCurtainMeters] = useState(measurement?.curtain_meters ? String(measurement.curtain_meters) : "");
  const [tulleFabricId, setTulleFabricId] = useState(measurement?.tulle_fabric || "");
  const [tulleMeters, setTulleMeters] = useState(measurement?.tulle_meters ? String(measurement.tulle_meters) : "");
  const [corniceItemId, setCorniceItemId] = useState(measurement?.cornice_item || "");
  const [corniceQuantity, setCorniceQuantity] = useState(measurement?.cornice_quantity ? String(measurement.cornice_quantity) : "");
  const [hardwareItemId, setHardwareItemId] = useState(measurement?.hardware_item || "");
  const [hardwareQuantity, setHardwareQuantity] = useState(measurement?.hardware_quantity ? String(measurement.hardware_quantity) : "");
  const [notes, setNotes] = useState(measurement?.notes || "");

  // Data hooks. Ткань штор и ткань тюля — раздельные категории склада, иначе
  // в обоих выпадашках показывался один общий список (включая тюль в поле
  // «Ткань штор» и наоборот).
  const { data: curtainFabricsData } = useFabrics({ category: "fabric", pageSize: 100, isActive: true });
  const curtainFabrics = curtainFabricsData?.results ?? [];
  const { data: tulleFabricsData } = useFabrics({ category: "tulle", pageSize: 100, isActive: true });
  const tulleFabrics = tulleFabricsData?.results ?? [];

  // Крепление — позиции склада категории «Карниз», фурнитура — категории «Фурнитура».
  const { data: corniceItemsData } = useQuery({
    queryKey: ["inventory", "items", "cornice"],
    queryFn: () => fetchInventoryItems({ category: "cornice", page_size: 200, is_active: true }),
    staleTime: 30 * 1000,
  });
  const corniceItems = corniceItemsData?.results ?? [];
  const { data: hardwareItemsData } = useQuery({
    queryKey: ["inventory", "items", "accessory"],
    queryFn: () => fetchInventoryItems({ category: "accessory", page_size: 200, is_active: true }),
    staleTime: 30 * 1000,
  });
  const hardwareItems = hardwareItemsData?.results ?? [];

  const selectedCorniceItem = corniceItems.find((it) => it.id === corniceItemId);
  const corniceUnitLabel = selectedCorniceItem?.unit_display || "шт";
  const selectedHardwareItem = hardwareItems.find((it) => it.id === hardwareItemId);
  const hardwareUnitLabel = selectedHardwareItem?.unit_display || "шт";

  const createMutation = useCreateMeasurement();
  const updateMutation = useUpdateMeasurement();
  const isEdit = !!measurement;

  // Validation
  const isValid = roomName.trim() && widthCm && heightCm;

  // Reset form
  const resetForm = () => {
    setRoomName("");
    setWidthCm("");
    setHeightCm("");
    setCurtainFabricId("");
    setCurtainMeters("");
    setTulleFabricId("");
    setTulleMeters("");
    setCorniceItemId("");
    setCorniceQuantity("");
    setHardwareItemId("");
    setHardwareQuantity("");
    setNotes("");
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    const payload = {
      order: orderId,
      room_name: roomName.trim(),
      window_name: roomName.trim(),
      width_cm: parseInt(widthCm),
      height_cm: parseInt(heightCm),
      depth_cm: null,
      ceiling_height_cm: null,
      mounting_type: "",
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
      cornice_item: corniceItemId || null,
      cornice_quantity: corniceQuantity ? parseFloat(corniceQuantity) : 0,
      hardware_item: hardwareItemId || null,
      hardware_quantity: hardwareQuantity ? parseFloat(hardwareQuantity) : 0,
      measured_by: null,
      notes: notes.trim(),
    };

    try {
      const result = measurement
        ? await updateMutation.mutateAsync({ id: measurement.id, data: payload })
        : await createMutation.mutateAsync(payload);
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
      <DialogContent className="sm:max-w-[560px] p-0 gap-0 overflow-auto max-h-[90vh] [&>button]:hidden">
        <div><ModalCloseX onClose={() => handleOpenChange(false)} /></div>
        <div className="px-8 pt-[72px] pb-8">
          {/* Header */}
          <DialogHeader className="mb-7">
            <DialogTitle className="text-[24px] font-bold text-[var(--t1)]">
              {isEdit ? "Редактирование замера" : "Создание замера"}
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

            {/* 2 & 3. Ширина / Высота */}
            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label className="text-[13px] font-medium text-[var(--t1)]">
                  2. Ширина (см) <span className="text-[#DC2626]">*</span>
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
                  3. Высота (см) <span className="text-[#DC2626]">*</span>
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

            {/* 4. Ткань штор */}
            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium text-[var(--t1)]">
                4. Ткань штор
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
                    {curtainFabrics.map((f) => (
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

            {/* 5. Ткань тюля */}
            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium text-[var(--t1)]">
                5. Ткань тюля
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
                    {tulleFabrics.map((f) => (
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

            {/* 6. Крепление */}
            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium text-[var(--t1)]">
                6. Крепление
              </Label>
              <div className="flex items-center gap-2.5">
                <Select value={corniceItemId} onValueChange={setCorniceItemId}>
                  <SelectTrigger className={`flex-1 ${selectTriggerCls}`}>
                    <SelectValue placeholder="Выберите крепление" />
                  </SelectTrigger>
                  <SelectContent>
                    {corniceItems.map((it) => (
                      <SelectItem key={it.id} value={it.id}>
                        {it.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-[13px] text-[var(--t3)] shrink-0">
                  {corniceUnitLabel}
                </span>
                <Input
                  className={`${inputCls} w-[72px] text-center shrink-0`}
                  type="number"
                  min={0}
                  step={0.1}
                  value={corniceQuantity}
                  onChange={(e) => setCorniceQuantity(e.target.value)}
                />
              </div>
            </div>

            {/* 7. Фурнитура */}
            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium text-[var(--t1)]">
                7. Фурнитура
              </Label>
              <div className="flex items-center gap-2.5">
                <Select value={hardwareItemId} onValueChange={setHardwareItemId}>
                  <SelectTrigger className={`flex-1 ${selectTriggerCls}`}>
                    <SelectValue placeholder="Выберите фурнитуру" />
                  </SelectTrigger>
                  <SelectContent>
                    {hardwareItems.map((it) => (
                      <SelectItem key={it.id} value={it.id}>
                        {it.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-[13px] text-[var(--t3)] shrink-0">
                  {hardwareUnitLabel}
                </span>
                <Input
                  className={`${inputCls} w-[72px] text-center shrink-0`}
                  type="number"
                  min={0}
                  step={0.1}
                  value={hardwareQuantity}
                  onChange={(e) => setHardwareQuantity(e.target.value)}
                />
              </div>
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
              disabled={!isValid || createMutation.isPending || updateMutation.isPending}
              className="w-full h-12 bg-[#60CCED] hover:bg-[#4DBCE0] text-white text-[15px] font-semibold rounded-[var(--r)] mt-1 disabled:opacity-50"
            >
              {createMutation.isPending || updateMutation.isPending
                ? (isEdit ? "Сохранение..." : "Создание...")
                : (isEdit ? "Сохранить" : "Создать")}
            </Button>

            {/* Error — раньше здесь проверялась только createMutation.isError,
                поэтому ошибка сохранения РЕДАКТИРОВАНИЯ (400 от бэка — например,
                несовпадение категории у крепления/фурнитуры) проходила молча:
                модалка не закрывалась, но пользователь не видел, что и почему
                не сохранилось. */}
            {(createMutation.isError || updateMutation.isError) && (
              <p className="text-[13px] text-[#DC2626] text-center">
                {(createMutation.error || updateMutation.error)?.message || "Не удалось сохранить замер"}
              </p>
            )}
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

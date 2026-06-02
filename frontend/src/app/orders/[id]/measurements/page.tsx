"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchMeasurements,
  createMeasurement,
  type MeasurementPayload,
} from "@/services/http/orders";
import { useRole } from "@/hooks/useRole";
import { ArrowLeft, Ruler, Loader2 } from "lucide-react";

const FABRIC_OPTIONS = [
  { value: "", label: "Не выбрано" },
  { value: "curtain", label: "Ткань" },
  { value: "tulle", label: "Тюль" },
];

export default function OrderMeasurementsPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  const queryClient = useQueryClient();
  const { role } = useRole();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<MeasurementPayload>({
    room_name: "",
    window_number: "",
    width: 0,
    height: 0,
    fabric_type: undefined,
    fabric_meters: undefined,
    fabric_name: "",
    mounting_type: "",
    comment: "",
  });

  const {
    data: measurementsData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["order-measurements", orderId],
    queryFn: () => fetchMeasurements(orderId),
    enabled: !!orderId,
  });

  const createMutation = useMutation({
    mutationFn: (payload: MeasurementPayload) => createMeasurement(orderId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-measurements", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order-execution", orderId] });
      setShowForm(false);
      setForm({
        room_name: "",
        window_number: "",
        width: 0,
        height: 0,
        fabric_type: undefined,
        fabric_meters: undefined,
        fabric_name: "",
        mounting_type: "",
        comment: "",
      });
    },
  });

  const canEdit = role === "owner" || role === "designer";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.room_name || !form.width || !form.height) return;
    createMutation.mutate(form);
  };

  if (isLoading) {
    return (
      <>
        <PageHeader title="Замеры" description="Загрузка..." />
        <LoadingState message="Загрузка замеров..." />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Замеры" description="Ошибка загрузки">
          <Button asChild variant="outline">
            <Link href={`/orders/${orderId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              К заказу
            </Link>
          </Button>
        </PageHeader>
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error?.message || "Ошибка загрузки"}</p>
        </div>
      </>
    );
  }

  const measurements = measurementsData?.results || [];

  return (
    <>
      <PageHeader
        title="Замеры"
        description={
          measurements.length > 0
            ? `${measurements.length} замер(ов)`
            : "Замеры ещё не добавлены"
        }
      >
        <Button asChild variant="outline">
          <Link href={`/orders/${orderId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            К заказу
          </Link>
        </Button>
      </PageHeader>

      {/* Existing measurements */}
      {measurements.length === 0 && !showForm && (
        <Card className="mb-6">
          <CardContent className="pt-6 text-center text-slate-500">
            Замеры ещё не добавлены
          </CardContent>
        </Card>
      )}

      <div className="space-y-4 mb-6">
        {measurements.map((m) => (
          <Card key={m.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {m.room_name}
                {m.window_name ? ` — ${m.window_name}` : ""}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Ruler className="h-4 w-4" />
                {m.width_cm} × {m.height_cm} см
              </div>
              {m.mounting_type && (
                <p className="text-slate-600">Крепление: {m.mounting_type}</p>
              )}
              {m.curtain_fabric && (
                <p className="text-slate-600">
                  Ткань: {m.curtain_fabric}
                  {m.curtain_meters ? ` (${m.curtain_meters} м)` : ""}
                </p>
              )}
              {m.tulle_fabric && (
                <p className="text-slate-600">
                  Тюль: {m.tulle_fabric}
                  {m.tulle_meters ? ` (${m.tulle_meters} м)` : ""}
                </p>
              )}
              {m.notes && <p className="text-slate-600">{m.notes}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add button */}
      {canEdit && !showForm && (
        <Button onClick={() => setShowForm(true)} className="mb-6">
          + Добавить замер
        </Button>
      )}

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Новый замер</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="room_name">Комната *</Label>
                  <Input
                    id="room_name"
                    placeholder="Гостиная"
                    value={form.room_name}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, room_name: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="window_number">Окно</Label>
                  <Input
                    id="window_number"
                    placeholder="1"
                    value={form.window_number || ""}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, window_number: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="width">Ширина (см) *</Label>
                  <Input
                    id="width"
                    type="number"
                    placeholder="150"
                    value={form.width || ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        width: parseFloat(e.target.value) || 0,
                      }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">Высота (см) *</Label>
                  <Input
                    id="height"
                    type="number"
                    placeholder="200"
                    value={form.height || ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        height: parseFloat(e.target.value) || 0,
                      }))
                    }
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Тип ткани</Label>
                <Select
                  value={form.fabric_type || ""}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      fabric_type: value as "curtain" | "tulle" | undefined,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите тип" />
                  </SelectTrigger>
                  <SelectContent>
                    {FABRIC_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.fabric_type && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fabric_meters">Метраж (м)</Label>
                    <Input
                      id="fabric_meters"
                      type="number"
                      step="0.1"
                      placeholder="3.5"
                      value={form.fabric_meters || ""}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          fabric_meters: parseFloat(e.target.value) || undefined,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fabric_name">Название ткани</Label>
                    <Input
                      id="fabric_name"
                      placeholder="Название"
                      value={form.fabric_name || ""}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, fabric_name: e.target.value }))
                      }
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="mounting_type">Тип крепления</Label>
                <Input
                  id="mounting_type"
                  placeholder="Потолочный карниз"
                  value={form.mounting_type || ""}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, mounting_type: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="comment">Комментарий</Label>
                <Textarea
                  id="comment"
                  placeholder="Примечания..."
                  value={form.comment || ""}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, comment: e.target.value }))
                  }
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-4">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Сохранение...
                    </>
                  ) : (
                    "Сохранить"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Отмена
                </Button>
              </div>

              {createMutation.isError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
                  {createMutation.error?.message || "Ошибка сохранения"}
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      )}
    </>
  );
}

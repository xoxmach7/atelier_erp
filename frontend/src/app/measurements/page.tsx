/**
 * Measurements Page - Backend Integration Sprint
 *
 * NOTE: This module now uses backend API for persistence.
 * The localStorage draft mode is deprecated and removed.
 *
 * Backend Status:
 * - Measurement model with API endpoints
 * - CRUD operations via REST API
 * - Data persistence: PostgreSQL via Django backend
 * - Order linking: each measurement linked to an order
 *
 * API DEBT NOTE:
 * - Uses /api/measurements/ (legacy DRF ViewSet endpoint)
 * - NOT using /api/v1/ service-layer architecture
 * - If refactoring to v1 API: migrate to atelier_erp.api.v1 urls
 *
 * Field Mapping (Old Draft UI → Backend Model):
 * ┌─────────────────────────────┬────────────────────────┬──────────────────────────────┐
 * │ Old Draft UI                │ Backend Field          │ Notes                        │
 * ├─────────────────────────────┼────────────────────────┼──────────────────────────────┤
 * │ Project.client_name         │ order (FK)             │ Now linked to real Order     │
 * │ Room.name                   │ room_name              │ Direct mapping               │
 * │ Item.name                   │ window_name            │ Direct mapping               │
 * │ Item.width_cm               │ width_cm               │ Direct mapping               │
 * │ Item.height_cm              │ height_cm              │ Direct mapping               │
 * │ Item.depth_cm               │ depth_cm               │ Direct mapping               │
 * │ Item.ceiling_height_cm      │ ceiling_height_cm      │ Direct mapping               │
 * │ Item.mounting_type          │ mounting_type          │ Direct mapping               │
 * │ Item.cornice_type           │ selected_cornice_type  │ Different field name         │
 * │ Item.is_electric_cornice    │ selected_cornice_type  │ Boolean→"electric" string   │
 * │ Project.measurer_name       │ measured_by (auto)     │ Auto-set from auth user      │
 * │ (not collected)             │ window_type            │ Optional - not in old UI     │
 * │ (not collected)             │ has_radiator           │ Optional - not in old UI     │
 * │ (not collected)             │ has_slope              │ Optional - not in old UI     │
 * │ (not collected)             │ obstacles              │ Optional - not in old UI     │
 * │ (not collected)             │ selected_fabric        │ Optional - not in old UI     │
 * └─────────────────────────────┴────────────────────────┴──────────────────────────────┘
 */

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/protected-route";
import {
  PageHeader,
  EmptyState,
  LoadingState,
  ErrorState,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Ruler, Pencil, Trash2, Search, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useMeasurements, useCreateMeasurement, useDeleteMeasurement } from "@/hooks/useMeasurements";
import { useOrders } from "@/hooks/useOrders";
import type { MeasurementDTO } from "@/types";

// Form state for new/edit measurement
interface MeasurementFormData {
  order: string;
  room_name: string;
  window_name: string;
  width_cm: number;
  height_cm: number;
  depth_cm: number | null;
  ceiling_height_cm: number | null;
  mounting_type: string;
  window_type: string;
  has_radiator: boolean;
  has_slope: boolean;
  obstacles: string;
  selected_fabric: string | null;
  selected_cornice_type: string;
  notes: string;
  measured_by: string | null;
}

const EMPTY_FORM: MeasurementFormData = {
  order: "",
  room_name: "",
  window_name: "",
  width_cm: 0,
  height_cm: 0,
  depth_cm: null,
  ceiling_height_cm: null,
  mounting_type: "",
  window_type: "",
  has_radiator: false,
  has_slope: false,
  obstacles: "",
  selected_fabric: null,
  selected_cornice_type: "",
  notes: "",
  measured_by: null,
};

function MeasurementsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState<MeasurementFormData>({
    ...EMPTY_FORM,
    order: orderId || "",
  });

  // Fetch measurements from backend - filter by order if provided
  const { data, isLoading, isError, error } = useMeasurements({
    search: searchQuery || undefined,
    order: orderId || undefined,
    pageSize: 50,
  });

  // Fetch orders for linking
  const { data: ordersData } = useOrders({ pageSize: 100 });

  // Mutations
  const createMutation = useCreateMeasurement();
  const deleteMutation = useDeleteMeasurement();

  const measurements = data?.results || [];
  const orders = ordersData?.results || [];

  const handleCreate = async () => {
    if (!formData.order) return;

    await createMutation.mutateAsync({
      ...formData,
      depth_cm: formData.depth_cm || null,
      ceiling_height_cm: formData.ceiling_height_cm || null,
      measured_by: null, // Set by backend
    });

    setFormData({ ...EMPTY_FORM, order: formData.order });
    setIsCreateDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Удалить этот замер?")) {
      await deleteMutation.mutateAsync(id);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <>
        <PageHeader
          title="Замеры"
          description="Управление замерами окон, привязанными к заказам"
        >
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Новый замер
          </Button>
        </PageHeader>
        <LoadingState message="Загрузка замеров..." />
      </>
    );
  }

  // Error state
  if (isError) {
    return (
      <>
        <PageHeader
          title="Замеры"
          description="Управление замерами окон, привязанными к заказам"
        >
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Новый замер
          </Button>
        </PageHeader>
        <ErrorState
          title="Ошибка загрузки замеров"
          description={error?.message || "Что-то пошло не так"}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={orderId ? `Замеры по заказу` : "Замеры"}
        description={orderId ? `Фильтр по заказу ${orderId.slice(0, 8)}...` : "Управление замерами окон, привязанными к заказам"}
      >
        <div className="flex items-center gap-2">
          {orderId ? (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/orders/${orderId}`}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  К заказу
                </Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => router.push("/measurements")}>
                Сбросить фильтр
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link href="/orders">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Заказы
              </Link>
            </Button>
          )}
          <Button onClick={() => {
            setFormData({ ...EMPTY_FORM, order: orderId || "" });
            setIsCreateDialogOpen(true);
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Новый замер
          </Button>
        </div>
      </PageHeader>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Поиск по комнате или окну..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Measurements List */}
      {measurements.length === 0 ? (
        <EmptyState
          title="Замеров пока нет"
          description="Создавайте замеры при снятии размеров окон для заказов"
          icon={<Ruler className="h-6 w-6 text-slate-600" />}
          action={{
            label: "Создать первый замер",
            onClick: () => {
              setFormData({ ...EMPTY_FORM, order: orderId || "" });
              setIsCreateDialogOpen(true);
            },
          }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {measurements.map((m: MeasurementDTO) => (
            <MeasurementCard
              key={m.id}
              measurement={m}
              orders={orders}
              onDelete={() => handleDelete(m.id)}
            />
          ))}
        </div>
      )}

      {/* Create Sheet */}
      <Sheet open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <SheetContent className="w-125 sm:w-150 overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Новый замер</SheetTitle>
          </SheetHeader>
          <div className="py-4">
            <MeasurementForm
              formData={formData}
              setFormData={setFormData}
              orders={orders}
            />
          </div>
          <SheetFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.order || createMutation.isPending}
            >
              {createMutation.isPending ? "Сохранение..." : "Сохранить замер"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

// Measurement Card Component
interface MeasurementCardProps {
  measurement: MeasurementDTO;
  orders: Array<{ id: string; order_number: string; customer_name: string }>;
  onDelete: () => void;
}

function MeasurementCard({ measurement, orders, onDelete }: MeasurementCardProps) {
  const order = orders.find((o) => o.id === measurement.order);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold">{measurement.room_name}</h3>
            <p className="text-sm text-slate-500">{measurement.window_name || "Окно"}</p>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href={`/measurements/${measurement.id}`}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-600"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-slate-500">Ширина:</span>{" "}
            <span className="font-medium">{measurement.width_cm} см</span>
          </div>
          <div>
            <span className="text-slate-500">Высота:</span>{" "}
            <span className="font-medium">{measurement.height_cm} см</span>
          </div>
        </div>

        {measurement.mounting_type && (
          <div className="mt-2">
            <Badge variant="secondary">
              {measurement.mounting_type.replace("_", " ")}
            </Badge>
          </div>
        )}

        <div className="mt-3 pt-3 border-t text-xs text-slate-500 space-y-1">
          <div>
            <span className="text-slate-400">Заказ:</span>{" "}
            {order ? (
              <>
                <span className="font-medium text-slate-600">{order.order_number}</span>
                <span className="text-slate-400"> — {order.customer_name}</span>
              </>
            ) : (
              <span className="text-slate-400">Неизвестно</span>
            )}
          </div>
          <div className="flex gap-3">
            <span>
              <span className="text-slate-400">Кем:</span>{" "}
              <span className="text-slate-600">
                {measurement.measured_by_name || "Неизвестно"}
              </span>
            </span>
            <span>
              <span className="text-slate-400">Когда:</span>{" "}
              <span className="text-slate-600">
                {new Date(measurement.measured_at).toLocaleDateString()}
              </span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Measurement Form Component
interface MeasurementFormProps {
  formData: MeasurementFormData;
  setFormData: (data: MeasurementFormData) => void;
  orders: Array<{ id: string; order_number: string; customer_name: string }>;
}

function MeasurementForm({ formData, setFormData, orders }: MeasurementFormProps) {
  const updateField = <K extends keyof MeasurementFormData>(
    field: K,
    value: MeasurementFormData[K]
  ) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <div className="grid gap-4 py-4">
      {/* Order Selection */}
      <div className="space-y-2">
        <Label htmlFor="order">Заказ *</Label>
        <Select
          value={formData.order}
          onValueChange={(value) => updateField("order", value)}
        >
          <SelectTrigger id="order">
            <SelectValue placeholder="Выберите заказ..." />
          </SelectTrigger>
          <SelectContent>
            {orders.map((order) => (
              <SelectItem key={order.id} value={order.id}>
                {order.order_number} — {order.customer_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Room & Window */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="room_name">Название комнаты *</Label>
          <Input
            id="room_name"
            value={formData.room_name}
            onChange={(e) => updateField("room_name", e.target.value)}
            placeholder="например, Гостиная"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="window_name">Название окна</Label>
          <Input
            id="window_name"
            value={formData.window_name}
            onChange={(e) => updateField("window_name", e.target.value)}
            placeholder="например, Окно 1"
          />
        </div>
      </div>

      {/* Dimensions */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="width_cm">Ширина (см) *</Label>
          <Input
            id="width_cm"
            type="number"
            value={formData.width_cm || ""}
            onChange={(e) => updateField("width_cm", parseInt(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="height_cm">Высота (см) *</Label>
          <Input
            id="height_cm"
            type="number"
            value={formData.height_cm || ""}
            onChange={(e) => updateField("height_cm", parseInt(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="depth_cm">Глубина (см)</Label>
          <Input
            id="depth_cm"
            type="number"
            value={formData.depth_cm || ""}
            onChange={(e) =>
              updateField("depth_cm", e.target.value ? parseInt(e.target.value) : null)
            }
            placeholder="Необязательно"
          />
        </div>
      </div>

      {/* Mounting Type */}
      <div className="space-y-2">
        <Label htmlFor="mounting_type">Тип крепления</Label>
        <Select
          value={formData.mounting_type}
          onValueChange={(value) => updateField("mounting_type", value)}
        >
          <SelectTrigger id="mounting_type">
            <SelectValue placeholder="Выберите тип крепления..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ceiling">Потолок</SelectItem>
            <SelectItem value="wall">Стена</SelectItem>
            <SelectItem value="niche">Ниша</SelectItem>
            <SelectItem value="window_recess">Оконный проем</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Примечания</Label>
        <Input
          id="notes"
          value={formData.notes}
          onChange={(e) => updateField("notes", e.target.value)}
          placeholder="Дополнительные детали..."
        />
      </div>
    </div>
  );
}

export default function MeasurementsPage() {
  return (
    <ProtectedRoute>
      <MeasurementsContent />
    </ProtectedRoute>
  );
}

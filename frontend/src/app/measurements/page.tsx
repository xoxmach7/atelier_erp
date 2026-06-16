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
import { getMountingTypeLabel } from "@/lib/mounting-types";
import { CreateMeasurementModal } from "@/components/shared/create-measurement-modal";
import {
  PageHeader,
  EmptyState,
  LoadingState,
  ErrorState,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Ruler, Pencil, Trash2, Search, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useMeasurements, useDeleteMeasurement } from "@/hooks/useMeasurements";
import { useOrders } from "@/hooks/useOrders";
import type { MeasurementDTO } from "@/types";

function MeasurementsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order");
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMeasurement, setEditingMeasurement] = useState<MeasurementDTO | null>(null);

  const openCreate = () => { setEditingMeasurement(null); setModalOpen(true); };
  const openEdit = (m: MeasurementDTO) => { setEditingMeasurement(m); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditingMeasurement(null); };

  // Fetch measurements from backend - filter by order if provided
  const { data, isLoading, isError, error } = useMeasurements({
    search: searchQuery || undefined,
    order: orderId || undefined,
    pageSize: 50,
  });

  // Fetch orders for linking
  const { data: ordersData } = useOrders({ pageSize: 100 });

  // Mutations
  const deleteMutation = useDeleteMeasurement();

  const measurements = data?.results || [];
  const orders = ordersData?.results || [];

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
          <Button onClick={openCreate}>
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
          <Button onClick={openCreate}>
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
            onClick: openCreate,
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
              onEdit={() => openEdit(m)}
            />
          ))}
        </div>
      )}

      {/* Measurement Modal (форма по Figma — создание и редактирование) */}
      <CreateMeasurementModal
        isOpen={modalOpen}
        onClose={closeModal}
        orderId={editingMeasurement?.order || orderId || ""}
        measurement={editingMeasurement}
        onSuccess={closeModal}
      />
    </>
  );
}

// Measurement Card Component - Sheber Design
interface MeasurementCardProps {
  measurement: MeasurementDTO;
  orders: Array<{ id: string; order_number: string; customer_name: string }>;
  onDelete: () => void;
  onEdit: () => void;
}

function MeasurementCard({ measurement, orders, onDelete, onEdit }: MeasurementCardProps) {
  const order = orders.find((o) => o.id === measurement.order);

  return (
    <Card className="bg-[var(--card-sheber)] border-[var(--border-sheber)] shadow-[var(--sh)] hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-[var(--borderl)]">
          <div>
            <h3 className="font-semibold text-[var(--t1)]">{measurement.room_name}</h3>
            <p className="text-sm text-[var(--t3)]">{measurement.window_name || "Окно / изделие"}</p>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-[var(--t3)] hover:text-[var(--a)] hover:bg-[var(--al)]"
              onClick={onEdit}
              title="Редактировать замер"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Dimensions */}
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="text-[var(--t3)]">Размер:</span>
          <span className="font-medium text-[var(--t1)]">
            {measurement.width_cm}×{measurement.height_cm} см
          </span>
        </div>

        {/* Phase 3: Fabrics */}
        <div className="mt-3 space-y-2 p-3 bg-[var(--bg)] rounded-[var(--r)]">
          {/* Curtain fabric */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--t3)]">Шторы:</span>
            <div className="flex items-center gap-2">
              <span className="font-medium text-[var(--t1)]">
                {measurement.curtain_fabric_details?.name || measurement.curtain_fabric_name || "не указана"}
              </span>
              {(measurement.curtain_meters && measurement.curtain_meters > 0) && (
                <span className="text-xs text-[var(--t2)] bg-[var(--card-sheber)] px-1.5 py-0.5 rounded">
                  {measurement.curtain_meters} м
                </span>
              )}
            </div>
          </div>

          {/* Tulle fabric */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--t3)]">Тюль:</span>
            <div className="flex items-center gap-2">
              <span className="font-medium text-[var(--t1)]">
                {measurement.tulle_fabric_details?.name || measurement.tulle_fabric_name || "не указана"}
              </span>
              {(measurement.tulle_meters && measurement.tulle_meters > 0) && (
                <span className="text-xs text-[var(--t2)] bg-[var(--card-sheber)] px-1.5 py-0.5 rounded">
                  {measurement.tulle_meters} м
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Mounting & Notes */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {measurement.mounting_type && (
            <span className="text-xs text-[var(--t3)] bg-[var(--bg)] px-2 py-0.5 rounded-full">
              {getMountingTypeLabel(measurement.mounting_type)}
            </span>
          )}
          {measurement.notes && (
            <span className="text-xs text-[var(--t3)] truncate max-w-[200px]">
              {measurement.notes}
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-[var(--borderl)] text-xs space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[var(--t3)]">Заказ:</span>
            {order ? (
              <>
                <span className="font-medium text-[var(--t1)]">{order.order_number}</span>
                <span className="text-[var(--t3)]">— {order.customer_name}</span>
              </>
            ) : (
              <span className="text-[var(--t3)]">Заказ не выбран</span>
            )}
          </div>
          <div className="flex gap-3">
            <span>
              <span className="text-[var(--t3)]">Кем:</span>{" "}
              <span className="text-[var(--t2)]">
                {measurement.measured_by_name || "Неизвестно"}
              </span>
            </span>
            <span>
              <span className="text-[var(--t3)]">Когда:</span>{" "}
              <span className="text-[var(--t2)]">
                {new Date(measurement.measured_at).toLocaleDateString()}
              </span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MeasurementsPage() {
  return (
    <ProtectedRoute>
      <MeasurementsContent />
    </ProtectedRoute>
  );
}

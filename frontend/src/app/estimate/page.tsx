"use client";

import { useState, useCallback } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import {
  ContextualNavigation,
  WorkflowNavPatterns,
  DraftStatusCard,
  ErrorState,
  ResetConfirmationDialog,
  ResetDialogPresets,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFabrics } from "@/hooks/useFabrics";
import { useEstimateDraft } from "./hooks/useEstimateDraft";
import {
  RoomSection,
  SummaryPanel,
  InventoryStatusCard,
} from "./components";
import { generateId } from "./utils/estimateHelpers";
import type { EstimateRoom, EstimateItem } from "@/types";
import { Plus, Ruler, ArrowLeft, Calculator } from "lucide-react";
import Link from "next/link";

/**
 * NOTE: This is a LOCAL-ONLY MVP module (see Sprint 9 shared components).
 *
 * Backend Status:
 * - Estimate model EXISTS in Django
 * - BUT: NO API save endpoint (localStorage-only via useEstimateDraft)
 * - Data persistence: localStorage only
 *
 * Sprint 9 Updates:
 * - Uses shared DraftStatusCard, ContextualNavigation, ResetConfirmationDialog, ErrorState
 * - Consistent empty/loading/error states with other modules
 */

function EstimateContent() {
  const { data: fabricsData, isLoading: fabricsLoading, isError: fabricsError, error } = useFabrics();
  const fabrics = fabricsData?.results || [];

  // Use localStorage-persisted draft (MVP: local only, no backend save yet)
  const { project, setProject, resetDraft } = useEstimateDraft();
  const [showResetDialog, setShowResetDialog] = useState(false);

  // Actions
  const addRoom = () => {
    const newRoom: EstimateRoom = {
      id: generateId(),
      name: `Room ${project.rooms.length + 1}`,
      items: [],
    };
    setProject((prev) => ({ ...prev, rooms: [...prev.rooms, newRoom] }));
  };

  const updateRoom = (roomId: string, updates: Partial<EstimateRoom>) => {
    setProject((prev) => ({
      ...prev,
      rooms: prev.rooms.map((r) => (r.id === roomId ? { ...r, ...updates } : r)),
    }));
  };

  const deleteRoom = (roomId: string) => {
    setProject((prev) => ({
      ...prev,
      rooms: prev.rooms.filter((r) => r.id !== roomId),
    }));
  };

  const addItemToRoom = (roomId: string) => {
    const room = project.rooms.find((r) => r.id === roomId);
    if (!room) return;

    const newItem: EstimateItem = {
      id: generateId(),
      name: `Item ${room.items.length + 1}`,
      width_cm: 0,
      height_cm: 0,
      curtain_fabric_id: null,
      curtain_fabric_meters: 0,
      tulle_fabric_id: null,
      tulle_fabric_meters: 0,
    };

    setProject((prev) => ({
      ...prev,
      rooms: prev.rooms.map((r) =>
        r.id === roomId ? { ...r, items: [...r.items, newItem] } : r
      ),
    }));
  };

  const updateItem = (roomId: string, itemId: string, updates: Partial<EstimateItem>) => {
    setProject((prev) => ({
      ...prev,
      rooms: prev.rooms.map((r) =>
        r.id === roomId
          ? { ...r, items: r.items.map((i) => (i.id === itemId ? { ...i, ...updates } : i)) }
          : r
      ),
    }));
  };

  const deleteItem = (roomId: string, itemId: string) => {
    setProject((prev) => ({
      ...prev,
      rooms: prev.rooms.map((r) =>
        r.id === roomId ? { ...r, items: r.items.filter((i) => i.id !== itemId) } : r
      ),
    }));
  };

  // Loading state
  if (fabricsLoading) {
    return (
      <>
        <PageHeader title="Estimate Builder" description="Create project estimates with fabric calculations">
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Add Room
          </Button>
        </PageHeader>
        <LoadingState message="Loading fabrics from inventory..." />
      </>
    );
  }

  // Error state
  if (fabricsError) {
    return (
      <>
        <PageHeader title="Estimate Builder" description="Create project estimates with fabric calculations">
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Add Room
          </Button>
        </PageHeader>

        <ErrorState
          title="Failed to load fabrics"
          description={error?.message || "Cannot load fabric inventory. Please try again later."}
          context={`Make sure the backend is running at ${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api"}`}
        />
      </>
    );
  }

  // Empty estimate state
  if (project.rooms.length === 0) {
    return (
      <>
        <PageHeader title="Estimate Builder" description="Create project estimates with fabric calculations">
          <Button onClick={addRoom}>
            <Plus className="mr-2 h-4 w-4" />
            Add Room
          </Button>
        </PageHeader>

        <ContextualNavigation links={WorkflowNavPatterns.estimate()} />
        <DraftStatusCard draftType="estimate" hasContent={false} />

        <div className="mt-6">
          <EmptyState
            title="Start building your estimate"
            description="Add rooms and items to calculate fabric costs. Select fabrics from your inventory with real-time stock checking."
            icon={<Ruler className="h-6 w-6 text-slate-600" />}
            action={{
              label: "Add First Room",
              onClick: addRoom,
            }}
          />
        </div>
      </>
    );
  }

  // Working estimate screen
  return (
    <>
      <PageHeader
        title="Estimate Builder"
        description={`${project.rooms.length} rooms • ${fabrics.length} fabrics available`}
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Orders
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/measurements">
              <Calculator className="mr-2 h-4 w-4" />
              Measurements
            </Link>
          </Button>
          <Button onClick={addRoom}>
            <Plus className="mr-2 h-4 w-4" />
            Add Room
          </Button>
        </div>
      </PageHeader>

      <ContextualNavigation links={WorkflowNavPatterns.estimate()} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main working area */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-slate-50 border-dashed">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Project Name</Label>
                  <Input
                    value={project.name}
                    onChange={(e) => setProject((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Apartment on Main St"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Client Name</Label>
                  <Input
                    value={project.client_name}
                    onChange={(e) =>
                      setProject((prev) => ({ ...prev, client_name: e.target.value }))
                    }
                    placeholder="e.g., Ivan Petrov"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {project.rooms.map((room) => (
              <RoomSection
                key={room.id}
                room={room}
                fabrics={fabrics}
                onUpdate={(updates) => updateRoom(room.id, updates)}
                onDelete={() => deleteRoom(room.id)}
                onAddItem={() => addItemToRoom(room.id)}
                onUpdateItem={(itemId, updates) => updateItem(room.id, itemId, updates)}
                onDeleteItem={(itemId) => deleteItem(room.id, itemId)}
              />
            ))}
          </div>
        </div>

        {/* Summary panel */}
        <div className="lg:col-span-1 space-y-4">
          <DraftStatusCard draftType="estimate" hasContent={true} />
          <SummaryPanel
            rooms={project.rooms}
            fabrics={fabrics}
            onReset={() => setShowResetDialog(true)}
          />
          <InventoryStatusCard fabricsCount={fabrics.length} />
        </div>
      </div>

      {/* Reset confirmation dialog - uses shared component */}
      <ResetConfirmationDialog
        isOpen={showResetDialog}
        onClose={() => setShowResetDialog(false)}
        onConfirm={() => {
          resetDraft();
          setShowResetDialog(false);
        }}
        {...ResetDialogPresets.estimate}
      />
    </>
  );
}

export default function EstimatePage() {
  return (
    <ProtectedRoute>
      <EstimateContent />
    </ProtectedRoute>
  );
}

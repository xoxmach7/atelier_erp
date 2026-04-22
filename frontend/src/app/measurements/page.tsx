/**
 * Measurements Page - Sprint 7/9 MVP
 *
 * NOTE: This is a LOCAL-ONLY MVP module (see Sprint 9 shared components).
 *
 * Backend Status:
 * - Measurement model EXISTS in Django
 * - BUT: NO API endpoint (localStorage-only via useMeasurementDraft)
 * - Data persistence: localStorage only
 *
 * Sprint 9 Updates:
 * - Uses shared DraftStatusCard, ContextualNavigation, ResetConfirmationDialog
 * - Consistent empty/loading states with other modules
 */

"use client";

import { useState, useCallback } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { PageHeader } from "@/components/shared/page-header";
import {
  ContextualNavigation,
  WorkflowNavPatterns,
  DraftStatusCard,
  EmptyState,
  LoadingState,
  ResetConfirmationDialog,
  ResetDialogPresets,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Plus, Ruler, RotateCcw, ArrowLeft, Calculator } from "lucide-react";
import Link from "next/link";
import { useMeasurementDraft } from "./hooks/useMeasurementDraft";
import {
  RoomSection,
  ProjectInfoCard,
  SummaryPanel,
} from "./components";
import { generateId } from "./utils/measurementHelpers";
import type { MeasurementRoom, MeasurementProject } from "@/types";

function MeasurementsContent() {
  const { project, setProject, hasDraft, isHydrated, summary, resetDraft } =
    useMeasurementDraft();
  const [showResetDialog, setShowResetDialog] = useState(false);

  // Actions
  const addRoom = useCallback(() => {
    const newRoom: MeasurementRoom = {
      id: generateId(),
      name: `Комната ${project.rooms.length + 1}`,
      items: [],
    };
    setProject((prev: MeasurementProject) => ({
      ...prev,
      rooms: [...prev.rooms, newRoom],
    }));
  }, [project.rooms.length, setProject]);

  const updateRoom = useCallback(
    (roomId: string, updates: Partial<MeasurementRoom>) => {
      setProject((prev: MeasurementProject) => ({
        ...prev,
        rooms: prev.rooms.map((room) =>
          room.id === roomId ? { ...room, ...updates } : room
        ),
      }));
    },
    [setProject]
  );

  const deleteRoom = useCallback(
    (roomId: string) => {
      setProject((prev: MeasurementProject) => ({
        ...prev,
        rooms: prev.rooms.filter((room) => room.id !== roomId),
      }));
    },
    [setProject]
  );

  const updateProject = useCallback(
    (updates: Partial<MeasurementProject>) => {
      setProject((prev: MeasurementProject) => ({ ...prev, ...updates }));
    },
    [setProject]
  );

  // Loading state while hydrating from localStorage
  if (!isHydrated) {
    return (
      <>
        <PageHeader
          title="Measurements"
          description="Manage measurement sheets and window dimensions"
        >
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Add Room
          </Button>
        </PageHeader>
        <ContextualNavigation links={WorkflowNavPatterns.measurements()} />
        <LoadingState message="Loading measurements..." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={project.name || "New Measurement"}
        description={
          project.client_name
            ? `Client: ${project.client_name}`
            : "Fill in measurement details"
        }
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Orders
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/estimate">
              <Calculator className="mr-2 h-4 w-4" />
              Estimate
            </Link>
          </Button>
          {hasDraft && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResetDialog(true)}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          )}
          <Button onClick={addRoom}>
            <Plus className="mr-2 h-4 w-4" />
            Add Room
          </Button>
        </div>
      </PageHeader>

      <ContextualNavigation links={WorkflowNavPatterns.measurements()} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content - left 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Project Info */}
          <ProjectInfoCard project={project} onChange={updateProject} />

          {/* Rooms */}
          {project.rooms.length === 0 ? (
            <EmptyState
              title="No rooms yet"
              description="Add rooms to start recording window measurements"
              icon={<Ruler className="h-6 w-6 text-slate-600" />}
              action={{
                label: "Add First Room",
                onClick: addRoom,
              }}
            />
          ) : (
            <div className="space-y-4">
              {project.rooms.map((room) => (
                <RoomSection
                  key={room.id}
                  room={room}
                  onChange={(updates: Partial<MeasurementRoom>) => updateRoom(room.id, updates)}
                  onDelete={() => deleteRoom(room.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar - right column */}
        <div className="space-y-6">
          <DraftStatusCard draftType="measurements" hasContent={hasDraft} />
          <SummaryPanel summary={summary} />
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
        {...ResetDialogPresets.measurements}
      />
    </>
  );
}

export default function MeasurementsPage() {
  return (
    <ProtectedRoute>
      <MeasurementsContent />
    </ProtectedRoute>
  );
}

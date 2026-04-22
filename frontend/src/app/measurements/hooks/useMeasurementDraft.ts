/**
 * useMeasurementDraft Hook
 * Manages localStorage persistence for measurement drafts
 *
 * NOTE: MVP - local only, no backend save yet.
 * Backend Measurement model exists but has NO API endpoint.
 * When backend adds MeasurementViewSet, migrate to API persistence.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import type { MeasurementProject, MeasurementSummary } from "@/types";
import { generateProjectId, generateId } from "../utils/measurementHelpers";

const DRAFT_STORAGE_KEY = "atelier_measurement_draft";

interface UseMeasurementDraftReturn {
  project: MeasurementProject;
  setProject: React.Dispatch<React.SetStateAction<MeasurementProject>>;
  hasDraft: boolean;
  isHydrated: boolean;
  saveDraft: () => void;
  resetDraft: () => void;
  loadDraft: () => void;
  summary: MeasurementSummary;
}

function createEmptyProject(): MeasurementProject {
  const now = new Date().toISOString();
  return {
    id: generateProjectId(),
    name: "Новый замер",
    client_name: "",
    measurement_date: new Date().toISOString().split("T")[0],
    measurer_name: "",
    rooms: [],
    created_at: now,
    updated_at: now,
  };
}

function calculateSummary(project: MeasurementProject): MeasurementSummary {
  const totalRooms = project.rooms.length;
  let totalWindows = 0;
  let totalWidthCm = 0;
  let totalHeightCm = 0;
  let hasElectricCornice = false;
  let needsElectricalAccess = false;

  for (const room of project.rooms) {
    for (const item of room.items) {
      totalWindows++;
      totalWidthCm += item.width_cm || 0;
      totalHeightCm += item.height_cm || 0;
      if (item.is_electric_cornice) hasElectricCornice = true;
      if (item.needs_electrical_access) needsElectricalAccess = true;
    }
  }

  return {
    totalRooms,
    totalWindows,
    totalWidthCm,
    totalHeightCm,
    hasElectricCornice,
    needsElectricalAccess,
  };
}

export function useMeasurementDraft(): UseMeasurementDraftReturn {
  const [project, setProject] = useState<MeasurementProject>(createEmptyProject);
  const [hasDraft, setHasDraft] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load draft from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const loaded: MeasurementProject = JSON.parse(saved);
        setProject(loaded);
        setHasDraft(true);
      }
    } catch (error) {
      console.warn("Failed to load measurement draft:", error);
    }
    setIsHydrated(true);
  }, []);

  // Save draft to localStorage
  const saveDraft = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      const toSave = {
        ...project,
        updated_at: new Date().toISOString(),
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(toSave));
      setHasDraft(true);
    } catch (error) {
      console.warn("Failed to save measurement draft:", error);
    }
  }, [project]);

  // Reset draft to empty state
  const resetDraft = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
    setProject(createEmptyProject());
    setHasDraft(false);
  }, []);

  // Explicitly load draft (for manual refresh)
  const loadDraft = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const loaded: MeasurementProject = JSON.parse(saved);
        setProject(loaded);
        setHasDraft(true);
      }
    } catch (error) {
      console.warn("Failed to load measurement draft:", error);
    }
  }, []);

  // Auto-save when project changes (debounced)
  useEffect(() => {
    if (!isHydrated) return;

    const timeoutId = setTimeout(() => {
      saveDraft();
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [project, isHydrated, saveDraft]);

  const summary = calculateSummary(project);

  return {
    project,
    setProject,
    hasDraft,
    isHydrated,
    saveDraft,
    resetDraft,
    loadDraft,
    summary,
  };
}

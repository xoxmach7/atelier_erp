/**
 * useEstimateDraft Hook
 * Manages localStorage persistence for estimate drafts
 * NOTE: MVP - local only, no backend save yet
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import type { EstimateProject, EstimateRoom, EstimateItem } from "@/types";
import { generateId } from "../utils/estimateHelpers";

const DRAFT_STORAGE_KEY = "atelier_estimate_draft";

// Serializable version of EstimateProject (without Date objects)
interface SerializedEstimateProject {
  id: string;
  name: string;
  client_name: string;
  rooms: SerializedEstimateRoom[];
  created_at: string; // ISO string
}

interface SerializedEstimateRoom {
  id: string;
  name: string;
  items: EstimateItem[];
}

function serializeProject(project: EstimateProject): SerializedEstimateProject {
  return {
    id: project.id,
    name: project.name,
    client_name: project.client_name,
    rooms: project.rooms.map((room) => ({
      id: room.id,
      name: room.name,
      items: room.items,
    })),
    created_at: project.created_at.toISOString(),
  };
}

function deserializeProject(serialized: SerializedEstimateProject): EstimateProject {
  return {
    id: serialized.id,
    name: serialized.name,
    client_name: serialized.client_name,
    rooms: serialized.rooms.map((room) => ({
      id: room.id,
      name: room.name,
      items: room.items,
    })),
    created_at: new Date(serialized.created_at),
  };
}

function createEmptyProject(): EstimateProject {
  return {
    id: generateId(),
    name: "New Estimate",
    client_name: "",
    rooms: [],
    created_at: new Date(),
  };
}

interface UseEstimateDraftReturn {
  project: EstimateProject;
  setProject: React.Dispatch<React.SetStateAction<EstimateProject>>;
  hasDraft: boolean;
  saveDraft: () => void;
  resetDraft: () => void;
  loadDraft: () => void;
}

export function useEstimateDraft(): UseEstimateDraftReturn {
  const [project, setProject] = useState<EstimateProject>(createEmptyProject);
  const [hasDraft, setHasDraft] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load draft from localStorage on mount. Runs once after mount (not during
  // render) because localStorage is unavailable during SSR — this is the
  // client-side hydration step, not a reset reacting to a dependency change.
  /* eslint-disable react-hooks/set-state-in-effect -- one-time client hydration from localStorage, cannot run during SSR render */
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const serialized: SerializedEstimateProject = JSON.parse(saved);
        const loaded = deserializeProject(serialized);
        setProject(loaded);
        setHasDraft(true);
      }
    } catch (error) {
      console.warn("Failed to load estimate draft:", error);
      // Continue with empty project
    }
    setIsHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Save draft to localStorage
  const saveDraft = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      const serialized = serializeProject(project);
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(serialized));
      setHasDraft(true);
    } catch (error) {
      console.warn("Failed to save estimate draft:", error);
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
        const serialized: SerializedEstimateProject = JSON.parse(saved);
        const loaded = deserializeProject(serialized);
        setProject(loaded);
        setHasDraft(true);
      }
    } catch (error) {
      console.warn("Failed to load estimate draft:", error);
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

  return {
    project,
    setProject,
    hasDraft,
    saveDraft,
    resetDraft,
    loadDraft,
  };
}

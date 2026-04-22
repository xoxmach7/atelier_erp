"use client";

import { Save, AlertTriangle } from "lucide-react";

/**
 * Props for DraftStatusCard component
 */
export interface DraftStatusCardProps {
  /** Whether draft has content (triggers "auto-saved" indicator) */
  hasContent?: boolean;
  /** Type of draft for display text */
  draftType: "estimate" | "measurements" | "general";
  /** Optional additional message */
  extraMessage?: string;
}

/**
 * DraftStatusCard - Consistent warning for local-only drafts
 *
 * This component provides uniform UX across all local-draft modules
 * (estimate, measurements) to clearly communicate:
 * - Data exists only in browser
 * - Auto-saves to localStorage
 * - NOT linked to any backend order (yet)
 *
 * Visual style: Amber warning (non-blocking, informational)
 *
 * @example
 * ```tsx
 * // In Estimate page
 * <DraftStatusCard draftType="estimate" hasContent={project.rooms.length > 0} />
 *
 * // In Measurements page
 * <DraftStatusCard draftType="measurements" hasContent={hasDraft} />
 * ```
 */
export function DraftStatusCard({
  hasContent = false,
  draftType,
  extraMessage,
}: DraftStatusCardProps) {
  const draftLabels = {
    estimate: {
      title: "Local Draft (Not Saved to Server)",
      description:
        "This estimate exists only in your browser. Data auto-saves locally but is NOT linked to any order yet.",
    },
    measurements: {
      title: "Local Draft (Not Saved to Server)",
      description:
        "This measurement sheet exists only in your browser. Data auto-saves locally but is NOT linked to any order yet.",
    },
    general: {
      title: "Local Draft (Not Saved to Server)",
      description:
        "This data exists only in your browser. Auto-saves locally but is NOT linked to any order yet.",
    },
  };

  const labels = draftLabels[draftType];

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <Save className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-amber-900 text-sm">{labels.title}</h4>
          <p className="text-xs text-amber-700 mt-1 leading-relaxed">
            {labels.description}
          </p>
          {hasContent && (
            <p className="text-xs text-amber-600 mt-2 font-medium">
              ✓ Draft auto-saved to browser storage
            </p>
          )}
          {extraMessage && (
            <p className="text-xs text-amber-600 mt-1 italic">{extraMessage}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * WorkflowInfoCard - Blue info card for cross-module workflow hints
 *
 * Use this for non-warning informational CTAs (e.g., Inventory → Estimate)
 */
export interface WorkflowInfoCardProps {
  /** Card title */
  title: string;
  /** Description text - can include JSX for links */
  description: React.ReactNode;
  /** Optional icon (defaults to info style) */
  icon?: React.ReactNode;
}

/**
 * WorkflowInfoCard - Informational cross-module workflow card
 *
 * Blue-themed (not amber/warning) for positive workflow guidance.
 * Use for: Inventory→Estimate, Orders→Payments, etc.
 *
 * @example
 * ```tsx
 * <WorkflowInfoCard
 *   title="Inventory → Estimate Workflow"
 *   description={
 *     <>
 *       Fabrics shown here are available in the{" "}
 *       <Link href="/estimate" className="underline">Estimate Builder</Link>
 *       . Low stock items are highlighted.
 *     </>
 *   }
 * />
 * ```
 */
export function WorkflowInfoCard({
  title,
  description,
  icon,
}: WorkflowInfoCardProps) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        {icon || <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />}
        <div>
          <h4 className="font-medium text-blue-900 text-sm">{title}</h4>
          <div className="text-xs text-blue-700 mt-1 leading-relaxed">
            {description}
          </div>
        </div>
      </div>
    </div>
  );
}

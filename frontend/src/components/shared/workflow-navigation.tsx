"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, LucideIcon } from "lucide-react";

/**
 * Navigation link configuration for workflow navigation
 */
export interface NavLinkConfig {
  href: string;
  label: string;
  icon?: LucideIcon;
  variant?: "default" | "outline";
}

/**
 * Props for ContextualNavigation component
 */
interface ContextualNavigationProps {
  /** Links to display (left to right) */
  links: NavLinkConfig[];
  /** Optional className for custom styling */
  className?: string;
}

/**
 * ContextualNavigation - Shared cross-module navigation component
 *
 * Use this to provide consistent "Back to X" / "Go to Y" navigation
 * across local-draft modules (estimate, measurements) and other workflows.
 *
 * Example:
 * ```tsx
 * <ContextualNavigation
 *   links={[
 *     { href: "/orders", label: "Back to Orders", icon: ArrowLeft },
 *     { href: "/estimate", label: "Go to Estimate", icon: Calculator },
 *   ]}
 * />
 * ```
 */
export function ContextualNavigation({
  links,
  className = "",
}: ContextualNavigationProps) {
  if (links.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 mb-4 ${className}`}>
      {links.map((link, index) => {
        const Icon = link.icon;
        const isBackNavigation = index === 0 && link.href !== "#";
        const isForwardNavigation = index > 0;

        return (
          <Button
            key={`${link.href}-${index}`}
            variant={link.variant || (isBackNavigation ? "outline" : "outline")}
            size="sm"
            asChild
          >
            <Link href={link.href}>
              {Icon && (
                <Icon
                  className={`h-4 w-4 ${
                    isForwardNavigation && !isBackNavigation ? "ml-2" : "mr-2"
                  }`}
                />
              )}
              {isBackNavigation ? (
                <>
                  {Icon && <Icon className="mr-2 h-4 w-4" />}
                  {link.label}
                </>
              ) : (
                <>
                  {link.label}
                  {Icon && isForwardNavigation && (
                    <ArrowRight className="ml-2 h-4 w-4" />
                  )}
                </>
              )}
            </Link>
          </Button>
        );
      })}
    </div>
  );
}

/**
 * Pre-configured navigation patterns for common workflows
 */
export const WorkflowNavPatterns = {
  /** Estimate page navigation: Orders ← → Measurements */
  estimate: ({
    backToOrders = true,
    toMeasurements = true,
  }: {
    backToOrders?: boolean;
    toMeasurements?: boolean;
  } = {}) => {
    const links: NavLinkConfig[] = [];
    if (backToOrders) {
      links.push({
        href: "/orders",
        label: "← К заказам",
        icon: ArrowLeft,
      });
    }
    if (toMeasurements) {
      links.push({
        href: "/measurements",
        label: "К замерам →",
        icon: ArrowRight,
      });
    }
    return links;
  },

  /** Measurements page navigation: Orders ← → Estimate */
  measurements: ({
    backToOrders = true,
    toEstimate = true,
  }: {
    backToOrders?: boolean;
    toEstimate?: boolean;
  } = {}) => {
    const links: NavLinkConfig[] = [];
    if (backToOrders) {
      links.push({
        href: "/orders",
        label: "← К заказам",
        icon: ArrowLeft,
      });
    }
    if (toEstimate) {
      links.push({
        href: "/estimate",
        label: "К смете →",
        icon: ArrowRight,
      });
    }
    return links;
  },
};

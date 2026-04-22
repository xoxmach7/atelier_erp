"use client";

/**
 * TECH DEBT / ARCHITECTURE NOTE:
 *
 * Current approach: Each protected page wraps content with <ProtectedRoute>.
 *
 * Alternative (Next.js 13+ App Router pattern):
 *   Create a route group like (app)/ with a layout.tsx that performs auth check
 *   for all pages in that segment. This would require moving all protected pages
 *   under (app)/ folder and updating relative imports.
 *
 *   Example structure:
 *     src/app/
 *       (public)/
 *         login/page.tsx
 *       (protected)/
 *         layout.tsx  <-- auth check here
 *         dashboard/page.tsx
 *         orders/page.tsx
 *         ...
 *
 * Decision: Keep current per-page wrapper approach as it's explicit and
 * moving files would require updating many relative imports (./hooks, ./components).
 * Refactor to route group when the app structure stabilizes.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { LoadingState } from "@/components/shared/loading-state";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingState message="Загрузка..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

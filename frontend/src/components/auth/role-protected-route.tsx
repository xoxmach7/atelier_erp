"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useRole, canAccess } from "@/hooks/useRole";
import { LoadingState } from "@/components/shared/loading-state";

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[]; // if set, only these roles can access
}

export function RoleProtectedRoute({ children, requiredRoles }: RoleProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const { role } = useRole();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    if (requiredRoles && !requiredRoles.includes(role)) {
      router.push("/dashboard");
      return;
    }
    if (!canAccess(role, pathname)) {
      router.push("/dashboard");
    }
  }, [isLoading, isAuthenticated, role, pathname, router, requiredRoles]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingState message="Загрузка..." />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <>{children}</>;
}

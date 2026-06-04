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
    // role === "none" (нет подходящей группы) — не редиректим, показываем
    // экран "нет доступа" ниже, иначе будет цикл редиректов на /dashboard.
    if (role === "none") return;
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

  // Default deny: авторизован, но без рабочей роли (группы не назначены).
  if (role === "none") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-lg font-semibold">Нет доступа</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Вашей учётной записи не назначена роль. Обратитесь к администратору.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

"use client";

import { useAuth } from "@/contexts/auth-context";

export type WebRole =
  | "none"
  | "owner"
  | "designer"
  | "warehouse"
  | "production"
  | "installation"
  | "finance";

const GROUP_TO_ROLE: Record<string, WebRole> = {
  // canonical
  Owner: "owner",
  Designer: "designer",
  Warehouse: "warehouse",
  Seamstress: "production",
  Installer: "installation",
  // legacy aliases
  Manager: "owner",
  Admin: "owner",
  Finance: "owner",
  Installation: "installation",
};

export function useRole(): { role: WebRole; isOwner: boolean; groups: string[] } {
  const { user } = useAuth();

  if (!user) return { role: "none", isOwner: false, groups: [] };

  if (user.is_superuser) return { role: "owner", isOwner: true, groups: user.groups };

  const groups = user.groups ?? [];

  for (const [group, role] of Object.entries(GROUP_TO_ROLE)) {
    if (groups.includes(group)) {
      return { role, isOwner: role === "owner", groups };
    }
  }

  return { role: "none", isOwner: false, groups };
}

/** Routes accessible per role (others redirect to /dashboard) */
export const ROLE_ALLOWED_PATHS: Record<WebRole, string[]> = {
  none: [],
  owner: ["*"],
  designer: ["/dashboard", "/orders", "/customers", "/quotes", "/estimates", "/estimate", "/measurements", "/work/designer", "/work/quotes", "/workspace", "/settings"],
  warehouse: ["/dashboard", "/orders", "/customers", "/inventory", "/work/warehouse", "/workspace", "/settings"],
  production: ["/dashboard", "/orders", "/work/production", "/workspace", "/settings"],
  installation: ["/dashboard", "/orders", "/installation", "/work/installation", "/workspace", "/settings"],
  finance: ["/dashboard", "/orders", "/payments", "/work/finance", "/workspace", "/settings"],
};

export function canAccess(role: WebRole, pathname: string): boolean {
  const allowed = ROLE_ALLOWED_PATHS[role];
  if (allowed.includes("*")) return true;
  return allowed.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

"use client";

import { useAuth } from "@/contexts/auth-context";

export type WebRole =
  | "owner"     // Manager, Admin, superuser — full access
  | "designer"  // Designer — orders, measurements, quotes
  | "warehouse" // Warehouse — orders (read), inventory
  | "production"// Seamstress — orders (limited), production queue
  | "installation" // Installer — orders (limited), installation queue
  | "finance";  // Finance — payments, finance queue

const GROUP_TO_ROLE: Record<string, WebRole> = {
  Manager: "owner",
  Admin: "owner",
  Designer: "designer",
  Warehouse: "warehouse",
  Seamstress: "production",
  Installer: "installation",
  Finance: "finance",
};

export function useRole(): { role: WebRole; isOwner: boolean; groups: string[] } {
  const { user } = useAuth();

  if (!user) return { role: "owner", isOwner: false, groups: [] };

  if (user.is_superuser) return { role: "owner", isOwner: true, groups: user.groups };

  const groups = user.groups ?? [];

  // Take the first matched role (priority: owner first)
  for (const [group, role] of Object.entries(GROUP_TO_ROLE)) {
    if (groups.includes(group)) {
      return { role, isOwner: role === "owner", groups };
    }
  }

  // Default: owner if no group set (dev accounts)
  return { role: "owner", isOwner: true, groups };
}

/** Routes accessible per role (others redirect to /dashboard) */
export const ROLE_ALLOWED_PATHS: Record<WebRole, string[]> = {
  owner: ["*"], // all
  designer: ["/dashboard", "/orders", "/quotes", "/estimates", "/estimate", "/measurements", "/work/designer", "/work/quotes", "/settings"],
  warehouse: ["/dashboard", "/orders", "/inventory", "/work/warehouse", "/settings"],
  production: ["/dashboard", "/orders", "/work/production", "/settings"],
  installation: ["/dashboard", "/orders", "/installation", "/work/installation", "/settings"],
  finance: ["/dashboard", "/orders", "/payments", "/work/finance", "/settings"],
};

export function canAccess(role: WebRole, pathname: string): boolean {
  const allowed = ROLE_ALLOWED_PATHS[role];
  if (allowed.includes("*")) return true;
  return allowed.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

"use client";

import { useAuth } from "@/contexts/auth-context";

export type WebRole =
  | "none"      // нет подходящей группы — доступ запрещён (default deny)
  | "owner"     // Owner (Manager/Admin/superuser) — full access
  | "designer"  // Designer — orders, measurements, quotes
  | "warehouse" // Warehouse — orders (read), inventory
  | "production"// Seamstress — orders (limited), production queue
  | "installation" // Installer — orders (limited), installation queue
  | "finance";  // Finance (legacy) — payments, finance queue

// Каноничные имена групп задаются на бэке в atelier_erp/roles.py (Roles).
// Держать в синхроне. Старые имена оставлены как алиасы на случай, если
// миграция канонизации (0012) ещё не раскатана на стенде. Owner идёт первым —
// при нескольких группах приоритет у владельца.
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

  // Не загружен / не авторизован — без доступа.
  if (!user) return { role: "none", isOwner: false, groups: [] };

  if (user.is_superuser) return { role: "owner", isOwner: true, groups: user.groups };

  const groups = user.groups ?? [];

  // Take the first matched role (priority: owner first)
  for (const [group, role] of Object.entries(GROUP_TO_ROLE)) {
    if (groups.includes(group)) {
      return { role, isOwner: role === "owner", groups };
    }
  }

  // Default DENY: нет подходящей группы → нет доступа (раньше тут был owner).
  return { role: "none", isOwner: false, groups };
}

/** Routes accessible per role (others redirect to /dashboard) */
export const ROLE_ALLOWED_PATHS: Record<WebRole, string[]> = {
  none: [], // default deny — никуда
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

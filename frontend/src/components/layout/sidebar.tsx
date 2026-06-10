"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeDollarSign,
  Boxes,
  Calculator,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  PlusCircle,
  Ruler,
  Scissors,
  Settings,
  Truck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useRole, type WebRole } from "@/hooks/useRole";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  match?: string[];
  roles?: WebRole[];
}

interface NavSection {
  title: string;
  items: NavItem[];
  muted?: boolean;
  roles?: WebRole[];
}

const ALL_NAV_SECTIONS: NavSection[] = [
  {
    title: "Главное",
    items: [
      { title: "Сегодня", href: "/dashboard", icon: LayoutDashboard },
      { title: "Заказы", href: "/orders", icon: ClipboardList, match: ["/orders"] },
      { title: "Клиенты", href: "/customers", icon: Users, match: ["/customers"] },
    ],
  },
  {
    title: "Рабочие роли",
    items: [
      { title: "Дизайнер", href: "/work/designer", icon: Ruler, roles: ["owner", "designer"] },
      { title: "КП", href: "/work/quotes", icon: FileText, match: ["/work/quotes", "/quotes"], roles: ["owner", "designer"] },
      { title: "Склад", href: "/work/warehouse", icon: Boxes, roles: ["owner", "warehouse"] },
      { title: "Пошив", href: "/work/production", icon: Scissors, roles: ["owner", "production"] },
      { title: "Установка", href: "/work/installation", icon: Truck, roles: ["owner", "installation"] },
      { title: "Финансы", href: "/work/finance", icon: BadgeDollarSign, roles: ["owner", "finance"] },
    ],
  },
  {
    title: "Действия",
    items: [
      { title: "Новый заказ", href: "/orders/new", icon: PlusCircle, roles: ["owner", "designer"] },
      { title: "Создать КП", href: "/estimate", icon: Calculator, roles: ["owner", "designer"] },
      { title: "Платежи", href: "/payments", icon: CreditCard, roles: ["owner", "finance"] },
    ],
  },
  {
    title: "Прочее",
    items: [
      { title: "Настройки", href: "/settings", icon: Settings },
    ],
  },
];

export const navSections = ALL_NAV_SECTIONS;

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const { role } = useRole();

  const filteredSections = ALL_NAV_SECTIONS
    .filter((s) => !s.roles || s.roles.includes(role))
    .map((s) => ({
      ...s,
      items: s.items.filter((item) => !item.roles || item.roles.includes(role)),
    }))
    .filter((s) => s.items.length > 0);

  return (
    <aside className={cn("w-64 shrink-0 border-r bg-white flex flex-col", className)}>
      <div className="px-4 py-4 border-b">
        <span className="text-lg font-semibold text-slate-900">Sheber ERP</span>
      </div>
      <ScrollArea className="flex-1 px-2 py-3">
        {filteredSections.map((section, i) => (
          <div key={section.title}>
            {i > 0 && <Separator className="my-2" />}
            <p className={cn(
              "px-2 py-1 text-xs font-medium uppercase tracking-wider",
              section.muted ? "text-slate-400" : "text-slate-500"
            )}>
              {section.title}
            </p>
            {section.items.map((item) => {
              const isActive = item.match
                ? item.match.some((m) => pathname.startsWith(m))
                : pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                    isActive
                      ? "bg-slate-100 text-slate-900 font-medium"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.title}
                </Link>
              );
            })}
          </div>
        ))}
      </ScrollArea>
    </aside>
  );
}

export function getActiveNavItem(pathname: string) {
  return ALL_NAV_SECTIONS
    .flatMap((s) => s.items)
    .find((item) => item.match
      ? item.match.some((m) => pathname.startsWith(m))
      : pathname === item.href || pathname.startsWith(item.href + "/")
    );
}

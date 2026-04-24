"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  ClipboardList,
  Calculator,
  Ruler,
  Package,
  Shirt,
  Wrench,
  CreditCard,
  Settings,
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

/**
 * Navigation organized by workflow phases
 */
const navSections: NavSection[] = [
  {
    title: "Обзор",
    items: [{ title: "Рабочий стол", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Продажи",
    items: [
      { title: "Заказы", href: "/orders", icon: ClipboardList },
      { title: "Смета", href: "/estimate", icon: Calculator },
      { title: "Замеры", href: "/measurements", icon: Ruler },
    ],
  },
  {
    title: "Производство",
    items: [
      { title: "Склад", href: "/inventory", icon: Package },
      { title: "Производство", href: "/production", icon: Shirt },
      { title: "Монтаж", href: "/installation", icon: Wrench },
    ],
  },
  {
    title: "Финансы",
    items: [{ title: "Платежи", href: "/payments", icon: CreditCard }],
  },
];

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-slate-900 text-slate-50"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      )}
    >
      <Icon className="h-4 w-4" />
      {item.title}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-30 hidden h-screen w-64 border-r bg-slate-50 md:block">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <span className="text-lg">Atelier ERP</span>
        </Link>
      </div>

      <ScrollArea className="h-[calc(100vh-4rem)]">
        <nav className="flex flex-col p-4">
          {navSections.map((section, sectionIndex) => (
            <div key={section.title} className={sectionIndex > 0 ? "mt-4" : ""}>
              <div className="px-3 mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {section.title}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {section.items.map((item) => (
                  <NavLink key={item.href} item={item} />
                ))}
              </div>
              {sectionIndex < navSections.length - 1 && (
                <Separator className="mt-4" />
              )}
            </div>
          ))}

          <Separator className="my-4" />

          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === "/settings"
                ? "bg-slate-900 text-slate-50"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <Settings className="h-4 w-4" />
            Настройки
          </Link>
        </nav>
      </ScrollArea>
    </aside>
  );
}

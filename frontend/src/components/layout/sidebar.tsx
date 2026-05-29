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
  Map,
  PlusCircle,
  Ruler,
  Scissors,
  Sparkles,
  Truck,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  match?: string[];
}

interface NavSection {
  title: string;
  items: NavItem[];
  muted?: boolean;
}

export const navSections: NavSection[] = [
  {
    title: "Главное",
    items: [
      { title: "Сегодня", href: "/dashboard", icon: LayoutDashboard },
      { title: "Заказы", href: "/orders", icon: ClipboardList, match: ["/orders"] },
    ],
  },
  {
    title: "Рабочие роли",
    items: [
      { title: "Дизайнер", href: "/work/designer", icon: Ruler },
      { title: "КП", href: "/work/quotes", icon: FileText, match: ["/work/quotes", "/quotes"] },
      { title: "Склад", href: "/work/warehouse", icon: Boxes },
      { title: "Пошив", href: "/work/production", icon: Scissors },
      { title: "Установка", href: "/work/installation", icon: Truck },
    ],
  },
  {
    title: "Действия",
    items: [
      { title: "Новый заказ", href: "/orders/new", icon: PlusCircle },
      { title: "Создать КП", href: "/estimate", icon: Calculator },
      { title: "Платежи", href: "/payments", icon: CreditCard },
      { title: "Финансовый список", href: "/work/finance", icon: BadgeDollarSign },
    ],
  },
  {
    title: "Демо / обзор",
    muted: true,
    items: [
      { title: "Карта процесса", href: "/workflow-map", icon: Map },
      { title: "Рабочие места", href: "/role-workspaces", icon: UserCog },
      { title: "Демо-продукт", href: "/product-demo", icon: Sparkles },
      { title: "MVP Preview", href: "/mvp-preview", icon: BadgeDollarSign },
    ],
  },
];

export function getActiveNavItem(pathname: string): NavItem | undefined {
  return navSections
    .flatMap((section) => section.items)
    .find((item) => {
      const matches = item.match || [item.href];
      return matches.some((match) => pathname === match || pathname.startsWith(`${match}/`));
    });
}

function NavLink({ item, muted = false }: { item: NavItem; muted?: boolean }) {
  const pathname = usePathname();
  const matches = item.match || [item.href];
  const isActive = matches.some((match) => pathname === match || pathname.startsWith(`${match}/`));
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        isActive
          ? "bg-sky-500 text-white shadow-sm"
          : muted
            ? "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            : "text-slate-700 hover:bg-sky-50 hover:text-sky-800"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.title}</span>
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-30 hidden h-screen w-72 border-r border-slate-200 bg-white lg:block">
      <div className="flex h-20 items-center border-b border-slate-100 px-6 py-5">
        <Link href="/dashboard" className="group flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-lg font-bold text-sky-700 transition group-hover:bg-sky-200">
            S
          </span>
          <span>
            <span className="block text-base font-semibold text-slate-950">Sheber ERP</span>
            <span className="block text-xs text-slate-500">рабочее приложение</span>
          </span>
        </Link>
      </div>

      <ScrollArea className="h-[calc(100vh-5rem)]">
        <nav className="flex flex-col p-4">
          {navSections.map((section, sectionIndex) => (
            <div key={section.title} className={sectionIndex > 0 ? "mt-5" : ""}>
              <div className="mb-2 px-3">
                <span className={cn("text-xs font-semibold uppercase tracking-wider", section.muted ? "text-slate-400" : "text-slate-500")}>
                  {section.title}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {section.items.map((item) => (
                  <NavLink key={item.href} item={item} muted={section.muted} />
                ))}
              </div>
              {sectionIndex < navSections.length - 1 && <Separator className="mt-5" />}
            </div>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}

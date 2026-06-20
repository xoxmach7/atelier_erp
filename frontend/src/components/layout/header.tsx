"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import {  CreditCard, LogOut, PlusCircle, Settings, User } from "lucide-react";
import { getActiveNavItem, navSections } from "./sidebar";

export function Header() {
  const pathname = usePathname();
  const { user, logout, isAuthenticated } = useAuth();
  const activeItem = getActiveNavItem(pathname);
  const isDemoRoute = ["/workflow-map", "/role-workspaces", "/product-demo", "/mvp-preview"].some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  const displayName = user
    ? `${user.first_name} ${user.last_name}`.trim() || user.username
    : "Гость";

  const email = user?.email || "";

  const initials = user
    ? (user.first_name?.[0] || user.username[0]).toUpperCase()
    : "?";

  const mobileItems = navSections.flatMap((section) => section.items);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 sm:px-5 lg:px-7">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="text-base font-semibold text-slate-950 lg:hidden">
              Sheber ERP
            </Link>
            <span className="hidden text-base font-semibold text-slate-950 lg:block">
              {activeItem?.title || "Sheber ERP"}
            </span>
            {isDemoRoute ? (
              <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
                Демо / обзор системы
              </Badge>
            ) : (
              <Badge variant="outline" className="hidden border-slate-200 bg-slate-50 text-slate-600 sm:inline-flex">
                MVP preview / local demo
              </Badge>
            )}
          </div>
          <div className="mt-1 hidden text-xs text-slate-500 sm:block">
            {isDemoRoute ? "Вспомогательные страницы для понимания системы" : "Роль → задачи → заказ → действие"}
          </div>
        </div>

        <div className="hidden items-center gap-2 2xl:flex">
          <Button asChild size="sm" variant="outline">
            <Link href="/orders/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Новый заказ
            </Link>
          </Button>
          <Button asChild size="sm" className="bg-sky-500 hover:bg-sky-600">
            <Link href="/payments">
              <CreditCard className="mr-2 h-4 w-4" />
              Платёж
            </Link>
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Avatar className="h-9 w-9 cursor-pointer">
                <AvatarFallback className="bg-sky-100 text-sky-700">
                  {isAuthenticated ? initials : <User className="h-4 w-4" />}
                </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <div className="px-1.5 py-1">
              <p className="text-sm font-medium">{displayName}</p>
              {email && <p className="text-xs text-muted-foreground">{email}</p>}
            </div>
            <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => window.location.href = "/settings"}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Настройки</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {isAuthenticated && (
                <DropdownMenuItem onClick={() => logout()} className="cursor-pointer text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Выйти</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="border-t border-slate-100 px-2 py-2 lg:hidden">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 px-2">
            {mobileItems
              .filter((item) => ["/dashboard", "/orders", "/work/designer", "/work/finance", "/product-demo"].includes(item.href))
              .map((item) => {
              const matches = item.match || [item.href];
              const isActive = matches.some((match) => pathname === match || pathname.startsWith(`${match}/`));
              const Icon = item.icon;
              return (
                <Button
                  key={item.href}
                  asChild
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  className={cn(isActive ? "bg-sky-500 hover:bg-sky-600" : "bg-white")}
                >
                  <Link href={item.href}>
                    <Icon className="mr-2 h-4 w-4" />
                    {item.title}
                  </Link>
                </Button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </header>
  );
}

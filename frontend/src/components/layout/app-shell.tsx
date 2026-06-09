"use client";

import { usePathname } from "next/navigation";

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * AppShell v2 — без sidebar и header.
 * Навигация: плитки на dashboard и кнопки «Назад» на страницах.
 */
export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#F0F4F8]">
      <main className="px-4 py-5 sm:px-5 lg:px-7">
        <div className="mx-auto w-full max-w-[1480px]">
          {children}
        </div>
      </main>
    </div>
  );
}

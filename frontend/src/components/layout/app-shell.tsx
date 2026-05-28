"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar />
      
      <div className="flex min-h-screen flex-col lg:ml-72">
        <Header />
        
        <main className="flex-1 px-4 py-5 sm:px-5 lg:px-7">
          <div className="mx-auto w-full max-w-[1480px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

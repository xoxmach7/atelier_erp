import { Sidebar } from "./sidebar";
import { Header } from "./header";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      
      <div className="flex min-h-screen flex-col md:ml-64">
        <Header />
        
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

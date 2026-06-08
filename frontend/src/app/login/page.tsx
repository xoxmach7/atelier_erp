"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Snowflake } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-400 to-cyan-500">
        <div className="text-white">Загрузка...</div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login({ username, password });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-sky-400 to-cyan-500 p-4">
      <div className="w-full max-w-[320px]">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo */}
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center">
              <Snowflake className="w-8 h-8 text-sky-500" strokeWidth={1.5} />
            </div>
          </div>

          {/* Brand */}
          <div className="text-center mb-6">
            <h1 className="text-lg font-semibold text-slate-900">Sheber</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {process.env.NEXT_PUBLIC_ORG_NAME || "Название организации"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Логин"
              required
              disabled={isLoading}
              className="bg-slate-50 border-slate-200 placeholder:text-slate-400"
            />

            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
              required
              disabled={isLoading}
              className="bg-slate-50 border-slate-200 placeholder:text-slate-400"
            />

            <Button
              type="submit"
              className="w-full bg-sky-500 hover:bg-sky-600 text-white font-medium mt-1"
              disabled={isLoading || !username || !password}
            >
              {isLoading ? "Вход..." : "Войти"}
            </Button>
          </form>
        </div>

        {/* Footer brand */}
        <p className="text-center text-white/60 text-sm mt-5 tracking-wide">
          SheberSolution
        </p>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-300 via-sky-300 to-cyan-300">
        <div className="text-white">Загрузка...</div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login({ username, password });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неверный логин или пароль");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-300 via-sky-300 to-cyan-300 p-6">
      {/* Card */}
      <div className="flex w-full max-w-[360px] flex-col items-center rounded-2xl bg-white p-10 shadow-[0_20px_60px_rgba(0,0,0,.12)]">
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo_transparent.png"
          alt="Sheber"
          width={140}
          height={140}
          className="mb-5"
        />

        {/* Title */}
        <h1 className="text-2xl font-bold text-[#0F172A]">Sheber Atelier</h1>
        <p className="mb-7 mt-1.5 text-[15px] text-[#94A3B8]">
          {process.env.NEXT_PUBLIC_ORG_NAME || "Название организации"}
        </p>

        {/* Error */}
        {error && (
          <div className="mb-4 w-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-2.5">
          <input
            type="text"
            placeholder="Логин"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={submitting}
            className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 text-sm text-[#0F172A] outline-none transition-colors placeholder:text-[#94A3B8] focus:border-[#0EA5E9] disabled:opacity-60"
          />
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={submitting}
            className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 text-sm text-[#0F172A] outline-none transition-colors placeholder:text-[#94A3B8] focus:border-[#0EA5E9] disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={submitting || !username || !password}
            className="mt-1 w-full rounded-lg bg-[#60CCED] py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#4DBCE0] disabled:opacity-70"
          >
            {submitting ? "Вход..." : "Войти"}
          </button>
        </form>
      </div>

      {/* Footer */}
      <p className="mt-8 text-base font-semibold tracking-wide text-white/90">
        SheberSolution
      </p>
    </div>
  );
}

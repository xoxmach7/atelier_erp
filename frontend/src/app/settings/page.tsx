"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "@/services/http/client";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { ArrowLeft, User, Mail, Shield, Lock } from "lucide-react";
import { useRouter } from "next/navigation";

interface MeResponse {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role?: string;
  groups?: string[];
  is_staff?: boolean;
  is_superuser?: boolean;
}

function useMe() {
  return useQuery<MeResponse, Error>({
    queryKey: ["me"],
    queryFn: () => get<MeResponse>("/me/"),
    staleTime: 5 * 60 * 1000,
  });
}

function getRoleLabel(data: MeResponse): string {
  if (data.is_superuser) return "Владелец (суперпользователь)";
  if (data.role) {
    const map: Record<string, string> = {
      owner: "Владелец",
      designer: "Дизайнер",
      warehouse: "Склад",
      production: "Пошив",
      installation: "Установка",
      finance: "Финансы",
    };
    return map[data.role] ?? data.role;
  }
  if (data.groups && data.groups.length > 0) {
    return data.groups.join(", ");
  }
  return "Пользователь";
}

export default function SettingsPage() {
  const router = useRouter();
  const { data: me, isLoading, error } = useMe();

  const fullName = me
    ? [me.first_name, me.last_name].filter(Boolean).join(" ") || me.username
    : "";

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#F0F4F8]">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-lg border border-[#E2E8F0] p-[7px] text-[#475569] hover:text-[#0EA5E9] transition-colors bg-white"
              title="На главную"
            >
              <ArrowLeft size={16} />
            </button>
            <h1 className="text-[26px] font-semibold text-[#0F172A]">Настройки</h1>
          </div>

          {isLoading ? (
            <div className="py-16">
              <LoadingState message="Загрузка профиля..." />
            </div>
          ) : error ? (
            <ErrorState
              title="Ошибка загрузки профиля"
              description={error.message}
            />
          ) : me ? (
            <div className="space-y-5">
              {/* Profile Card */}
              <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
                <div className="px-6 py-4 border-b border-[#F1F5F9]">
                  <h2 className="text-[16px] font-semibold text-[#0F172A]">Профиль</h2>
                </div>
                <div className="px-6 py-5 space-y-5">
                  {/* Name */}
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#E0F2FE]">
                      <User size={16} className="text-[#0EA5E9]" />
                    </div>
                    <div>
                      <p className="text-[12px] font-medium text-[#94A3B8] uppercase tracking-wider">
                        Имя
                      </p>
                      <p className="text-[15px] text-[#0F172A] mt-0.5">{fullName}</p>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#E0F2FE]">
                      <Mail size={16} className="text-[#0EA5E9]" />
                    </div>
                    <div>
                      <p className="text-[12px] font-medium text-[#94A3B8] uppercase tracking-wider">
                        Email
                      </p>
                      <p className="text-[15px] text-[#0F172A] mt-0.5">{me.email || "—"}</p>
                    </div>
                  </div>

                  {/* Role */}
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#EDE9FE]">
                      <Shield size={16} className="text-[#7C3AED]" />
                    </div>
                    <div>
                      <p className="text-[12px] font-medium text-[#94A3B8] uppercase tracking-wider">
                        Роль
                      </p>
                      <p className="text-[15px] text-[#0F172A] mt-0.5">{getRoleLabel(me)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Card */}
              <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
                <div className="px-6 py-4 border-b border-[#F1F5F9]">
                  <h2 className="text-[16px] font-semibold text-[#0F172A]">Безопасность</h2>
                </div>
                <div className="px-6 py-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FEF3C7]">
                        <Lock size={16} className="text-[#D97706]" />
                      </div>
                      <div>
                        <p className="text-[15px] text-[#0F172A]">Пароль</p>
                        <p className="text-[13px] text-[#94A3B8]">
                          Изменение пароля учётной записи
                        </p>
                      </div>
                    </div>
                    <button
                      className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-[14px] text-[#475569] hover:text-[#0EA5E9] hover:border-[#0EA5E9] transition-colors"
                      onClick={() => {
                        // TODO: implement password change modal or redirect
                        alert("Функция смены пароля будет доступна в ближайшем обновлении.");
                      }}
                    >
                      Сменить пароль
                    </button>
                  </div>
                </div>
              </div>

              {/* Info footer */}
              <p className="text-[12px] text-[#94A3B8] text-center pt-2">
                Данные профиля доступны только для чтения. Обратитесь к администратору для изменений.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </ProtectedRoute>
  );
}

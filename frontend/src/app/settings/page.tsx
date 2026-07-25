"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { get } from "@/services/http/client";
import { changePassword } from "@/services/http/auth";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { ModalCloseX } from "@/components/shared/modal-close";
import { ArrowLeft, User, Mail, Shield, Lock, Loader2 } from "lucide-react";
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

const EMPTY_PASSWORD_FORM = { current_password: "", new_password: "", confirm_password: "" };

export default function SettingsPage() {
  const router = useRouter();
  const { data: me, isLoading, error } = useMe();

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ ...EMPTY_PASSWORD_FORM });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const closePasswordModal = () => {
    setPasswordModalOpen(false);
    setPasswordForm({ ...EMPTY_PASSWORD_FORM });
    setPasswordError("");
    setPasswordSuccess(false);
  };

  const changePasswordMutation = useMutation({
    mutationFn: () => changePassword(passwordForm.current_password, passwordForm.new_password),
    onSuccess: () => {
      setPasswordSuccess(true);
      setPasswordError("");
    },
    onError: (e: unknown) => setPasswordError(e instanceof Error ? e.message : "Не удалось сменить пароль"),
  });

  const handlePasswordSubmit = () => {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError("Новый пароль и подтверждение не совпадают.");
      return;
    }
    setPasswordError("");
    changePasswordMutation.mutate();
  };

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
                      onClick={() => setPasswordModalOpen(true)}
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

      {passwordModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-6"
          style={{ background: "rgba(15,23,42,.35)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget && !changePasswordMutation.isPending) closePasswordModal(); }}
        >
          <div className="relative my-auto max-h-[90vh] w-full max-w-[420px] overflow-y-auto rounded-[14px] bg-white shadow-2xl">
            <ModalCloseX onClose={() => !changePasswordMutation.isPending && closePasswordModal()} />
            <div className="px-6 sm:px-[52px] pb-10 pt-[72px]">
              {passwordSuccess ? (
                <>
                  <h2 className="mb-2 text-[22px] font-semibold text-[#0F172A]">Пароль изменён</h2>
                  <p className="mb-6 text-[14px] text-[#94A3B8]">
                    При следующем входе используйте новый пароль.
                  </p>
                  <button
                    onClick={closePasswordModal}
                    className="w-full rounded-[10px] bg-[#60CCED] py-[14px] text-[16px] font-semibold text-white transition-colors hover:bg-[#4DBCE0]"
                  >
                    Готово
                  </button>
                </>
              ) : (
                <>
                  <h2 className="mb-8 text-[22px] font-semibold text-[#0F172A]">Смена пароля</h2>

                  <div className="mb-6">
                    <label className="block text-[15px] text-[#0F172A] mb-2">Текущий пароль</label>
                    <input
                      type="password"
                      autoFocus
                      value={passwordForm.current_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                      className="w-full rounded-[10px] bg-[#E9E9E9] px-4 py-[14px] text-[15px] text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-[15px] text-[#0F172A] mb-2">Новый пароль</label>
                    <input
                      type="password"
                      value={passwordForm.new_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                      className="w-full rounded-[10px] bg-[#E9E9E9] px-4 py-[14px] text-[15px] text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
                    />
                  </div>

                  <div className="mb-8">
                    <label className="block text-[15px] text-[#0F172A] mb-2">Подтвердите новый пароль</label>
                    <input
                      type="password"
                      value={passwordForm.confirm_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                      className="w-full rounded-[10px] bg-[#E9E9E9] px-4 py-[14px] text-[15px] text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
                    />
                  </div>

                  {passwordError && <p className="mb-4 text-[14px] text-[#DC2626]">{passwordError}</p>}

                  <button
                    onClick={handlePasswordSubmit}
                    disabled={
                      changePasswordMutation.isPending ||
                      !passwordForm.current_password ||
                      !passwordForm.new_password ||
                      !passwordForm.confirm_password
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#60CCED] py-[14px] text-[16px] font-semibold text-white transition-colors hover:bg-[#4DBCE0] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {changePasswordMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                    Сохранить
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
